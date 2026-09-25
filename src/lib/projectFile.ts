import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from "fflate";
import { z } from "zod";
import { normalizeSurvey, type ProjectMode, type RetrofitSurvey } from "./design";
import type { DraftRecommendation } from "./dxf";
import { normalizeTools, type ProjectToolsState } from "./projectTools";

/**
 * AV-SW project file (.avsw): one file per project, like a CAD file.
 *
 * It is a ZIP container:
 *   manifest.json      format name/version and the app version that saved it
 *   project.json       all project data except drawing bytes
 *   drawings/<id>.<ext> original drawing files, stored uncompressed
 */

export const PROJECT_FILE_EXTENSION = "avsw";
export const PROJECT_FORMAT = "avsw-project";
export const PROJECT_FORMAT_VERSION = 1;

export type DrawingKind = "pdf" | "dxf";

export type ProjectDrawing = {
  id: string;
  name: string;
  kind: DrawingKind;
  addedAt: string;
  bytes: Uint8Array;
};

export type ProjectDocument = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  mode: ProjectMode;
  survey: RetrofitSurvey;
  tools: ProjectToolsState;
  draft: DraftRecommendation[];
  drawings: ProjectDrawing[];
  activeDrawingId: string | null;
};

export class ProjectFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectFileError";
  }
}

const manifestSchema = z.object({
  format: z.literal(PROJECT_FORMAT),
  formatVersion: z.number().int().positive(),
  appVersion: z.string().optional(),
  savedAt: z.string().optional(),
});

const drawingEntrySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(["pdf", "dxf"]),
  addedAt: z.string(),
  path: z.string().regex(/^drawings\/[^/]+$/),
});

const projectJsonSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
  mode: z.enum(["new-build", "retrofit"]),
  survey: z.unknown(),
  tools: z.unknown(),
  draft: z.array(z.unknown()).default([]),
  drawings: z.array(drawingEntrySchema).default([]),
  activeDrawingId: z.string().nullable().default(null),
});

function newId() {
  return globalThis.crypto.randomUUID();
}

export function newProject(name = "Untitled project", now = new Date()): ProjectDocument {
  const timestamp = now.toISOString();
  return {
    id: newId(),
    name,
    createdAt: timestamp,
    updatedAt: timestamp,
    mode: "new-build",
    survey: normalizeSurvey(undefined),
    tools: normalizeTools(undefined),
    draft: [],
    drawings: [],
    activeDrawingId: null,
  };
}

export function drawingKindOf(fileName: string): DrawingKind | null {
  const extension = fileName.slice(fileName.lastIndexOf(".") + 1).toLowerCase();
  return extension === "pdf" || extension === "dxf" ? extension : null;
}

export function newDrawing(name: string, bytes: Uint8Array, now = new Date()): ProjectDrawing {
  const kind = drawingKindOf(name);
  if (!kind) throw new ProjectFileError(`${name} is not a PDF or DXF drawing.`);
  return { id: newId(), name, kind, addedAt: now.toISOString(), bytes };
}

export function activeDrawing(project: ProjectDocument) {
  return project.drawings.find((drawing) => drawing.id === project.activeDrawingId) ?? null;
}

/** Project name from a file path: "C:\\Jobs\\Smith Residence.avsw" -> "Smith Residence". */
export function projectNameFromPath(path: string) {
  const file = path.split(/[\\/]/).pop() ?? path;
  return file.replace(new RegExp(`\\.${PROJECT_FILE_EXTENSION}$`, "i"), "") || "Untitled project";
}

export function serializeProject(
  project: ProjectDocument,
  options: { appVersion?: string; savedAt?: Date } = {},
): Uint8Array {
  const savedAt = (options.savedAt ?? new Date()).toISOString();
  const entries: Zippable = {};

  const drawings = project.drawings.map((drawing) => {
    const path = `drawings/${drawing.id}.${drawing.kind}`;
    // PDFs are already compressed; storing keeps saves fast for large sets.
    entries[path] = [drawing.bytes, { level: 0 }];
    return { id: drawing.id, name: drawing.name, kind: drawing.kind, addedAt: drawing.addedAt, path };
  });

  const projectJson = {
    id: project.id,
    name: project.name,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    mode: project.mode,
    survey: project.survey,
    tools: project.tools,
    draft: project.draft,
    drawings,
    activeDrawingId: project.activeDrawingId,
  };

  const manifest = {
    format: PROJECT_FORMAT,
    formatVersion: PROJECT_FORMAT_VERSION,
    appVersion: options.appVersion,
    savedAt,
  };

  entries["manifest.json"] = strToU8(JSON.stringify(manifest, null, 2));
  entries["project.json"] = strToU8(JSON.stringify(projectJson, null, 2));
  return zipSync(entries);
}

function readJson(files: Record<string, Uint8Array>, name: string): unknown {
  const bytes = files[name];
  if (!bytes) throw new ProjectFileError(`The project file is missing ${name}.`);
  try {
    return JSON.parse(strFromU8(bytes));
  } catch {
    throw new ProjectFileError(`${name} in the project file is not valid JSON.`);
  }
}

export function parseProject(bytes: Uint8Array): ProjectDocument {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new ProjectFileError("This is not an AV-SW project file.");
  }

  const manifest = manifestSchema.safeParse(readJson(files, "manifest.json"));
  if (!manifest.success) throw new ProjectFileError("This is not an AV-SW project file.");
  if (manifest.data.formatVersion > PROJECT_FORMAT_VERSION) {
    throw new ProjectFileError(
      `This project was saved by a newer version of AV-SW${manifest.data.appVersion ? ` (${manifest.data.appVersion})` : ""}. Update AV-SW to open it.`,
    );
  }

  const parsed = projectJsonSchema.safeParse(readJson(files, "project.json"));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ProjectFileError(
      `The project data is damaged (${issue.path.join(".") || "project"}: ${issue.message}).`,
    );
  }
  const data = parsed.data;

  const drawings = data.drawings.map((entry) => {
    const drawingBytes = files[entry.path];
    if (!drawingBytes) {
      throw new ProjectFileError(`The drawing "${entry.name}" is missing from the project file.`);
    }
    return { id: entry.id, name: entry.name, kind: entry.kind, addedAt: entry.addedAt, bytes: drawingBytes };
  });

  const activeDrawingId =
    data.activeDrawingId && drawings.some((drawing) => drawing.id === data.activeDrawingId)
      ? data.activeDrawingId
      : (drawings[0]?.id ?? null);

  return {
    id: data.id,
    name: data.name,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    mode: data.mode,
    survey: normalizeSurvey(data.survey),
    tools: normalizeTools(data.tools),
    draft: data.draft as DraftRecommendation[],
    drawings,
    activeDrawingId,
  };
}
