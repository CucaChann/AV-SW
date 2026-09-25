import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from "fflate";
import { z } from "zod";
import { normalizeSurvey, type ProjectMode, type RetrofitSurvey } from "./design";
import type { DraftRecommendation } from "./dxf";
import { normalizeTools, type ProjectToolsState } from "./projectTools";
import { isRecord } from "./sanitize";

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

/** A loaded project plus the paths of fields that were invalid and reset to defaults. */
export type ProjectLoad = { project: ProjectDocument; repairs: string[] };

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
  // Checked field by field (with repairs) by the normalize functions below.
  survey: z.unknown().optional(),
  tools: z.unknown().optional(),
  draft: z.unknown().optional(),
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

function drawingPath(drawing: Pick<ProjectDrawing, "id" | "kind">) {
  return `drawings/${drawing.id}.${drawing.kind}`;
}

/** Everything but the drawing bytes, as stored in project.json. */
export function projectToJson(project: ProjectDocument) {
  return {
    id: project.id,
    name: project.name,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    mode: project.mode,
    survey: project.survey,
    tools: project.tools,
    draft: project.draft,
    drawings: project.drawings.map((drawing) => ({
      id: drawing.id,
      name: drawing.name,
      kind: drawing.kind,
      addedAt: drawing.addedAt,
      path: drawingPath(drawing),
    })),
    activeDrawingId: project.activeDrawingId,
  };
}

export function serializeProject(
  project: ProjectDocument,
  options: { appVersion?: string; savedAt?: Date } = {},
): Uint8Array {
  const entries: Zippable = {};
  for (const drawing of project.drawings) {
    // PDFs are already compressed; storing keeps saves fast for large sets.
    entries[drawingPath(drawing)] = [drawing.bytes, { level: 0 }];
  }

  const manifest = {
    format: PROJECT_FORMAT,
    formatVersion: PROJECT_FORMAT_VERSION,
    appVersion: options.appVersion,
    savedAt: (options.savedAt ?? new Date()).toISOString(),
  };

  entries["manifest.json"] = strToU8(JSON.stringify(manifest, null, 2));
  entries["project.json"] = strToU8(JSON.stringify(projectToJson(project), null, 2));
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

const DRAFT_SYSTEMS = new Set([
  "Lighting", "Lutron", "QTL", "Shades", "Network", "Audio", "Video", "Infrastructure",
]);

function normalizeDraft(value: unknown, repairs: string[]): DraftRecommendation[] {
  if (!Array.isArray(value)) {
    if (value !== undefined) repairs.push("draft");
    return [];
  }
  return value.filter((item, index): item is DraftRecommendation => {
    const valid =
      isRecord(item) &&
      typeof item.id === "string" &&
      typeof item.title === "string" &&
      typeof item.rationale === "string" &&
      DRAFT_SYSTEMS.has(item.system as string) &&
      ["High", "Medium", "Review"].includes(item.confidence as string) &&
      (item.room === undefined || typeof item.room === "string");
    if (!valid) repairs.push(`draft[${index}]`);
    return valid;
  });
}

/**
 * Builds a project from project.json data. `drawingBytes` supplies each
 * listed drawing (from the ZIP, or from the recovery store).
 */
export function projectFromJson(
  value: unknown,
  drawingBytes: (entry: { id: string; path: string }) => Uint8Array | undefined,
): ProjectLoad {
  const parsed = projectJsonSchema.safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ProjectFileError(
      `The project data is damaged (${issue.path.join(".") || "project"}: ${issue.message}).`,
    );
  }
  const data = parsed.data;

  const drawings = data.drawings.map((entry) => {
    const bytes = drawingBytes(entry);
    if (!bytes) {
      throw new ProjectFileError(`The drawing "${entry.name}" is missing from the project file.`);
    }
    return { id: entry.id, name: entry.name, kind: entry.kind, addedAt: entry.addedAt, bytes };
  });

  const activeDrawingId =
    data.activeDrawingId && drawings.some((drawing) => drawing.id === data.activeDrawingId)
      ? data.activeDrawingId
      : (drawings[0]?.id ?? null);

  const repairs: string[] = [];
  const project: ProjectDocument = {
    id: data.id,
    name: data.name,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    mode: data.mode,
    survey: normalizeSurvey(data.survey, repairs),
    tools: normalizeTools(data.tools, repairs),
    draft: normalizeDraft(data.draft, repairs),
    drawings,
    activeDrawingId,
  };
  return { project, repairs };
}

export function parseProjectWithRepairs(bytes: Uint8Array): ProjectLoad {
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

  return projectFromJson(readJson(files, "project.json"), (entry) => files[entry.path]);
}

export function parseProject(bytes: Uint8Array): ProjectDocument {
  return parseProjectWithRepairs(bytes).project;
}
