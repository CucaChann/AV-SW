import { readFileSync } from "node:fs";
import { strToU8, unzipSync, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import {
  activeDrawing,
  newDrawing,
  newProject,
  parseProject,
  parseProjectWithRepairs,
  PROJECT_FORMAT_VERSION,
  ProjectFileError,
  projectNameFromPath,
  serializeProject,
} from "./projectFile";
import { generateToolBom, newQtlRun } from "./projectTools";

function sampleProject() {
  const project = newProject("Smith Residence", new Date("2026-09-25T12:00:00Z"));
  const dxf = new Uint8Array(readFileSync("samples/apartment_demo.dxf"));
  const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0, 255, 128]);
  const plan = newDrawing("Level 1.dxf", dxf);
  const sheet = newDrawing("E-101 Lighting.pdf", pdf);
  return {
    ...project,
    mode: "retrofit" as const,
    survey: { ...project.survey, controlPlatform: "RadioRA 3" as const, speakerCount: 6 },
    tools: { ...project.tools, qtlRuns: [{ ...newQtlRun(), room: "Kitchen", lengthFt: 12 }] },
    drawings: [plan, sheet],
    activeDrawingId: sheet.id,
  };
}

describe("project file round trip", () => {
  it("restores every field and the exact drawing bytes", () => {
    const project = sampleProject();
    const restored = parseProject(serializeProject(project, { appVersion: "0.2.0" }));

    expect(restored).toEqual(project);
    expect(activeDrawing(restored)?.name).toBe("E-101 Lighting.pdf");
    expect(Array.from(restored.drawings[1].bytes)).toEqual(Array.from(project.drawings[1].bytes));
  });

  it("writes a readable manifest and stores drawings uncompressed", () => {
    const files = unzipSync(serializeProject(sampleProject(), { appVersion: "0.2.0" }));
    const manifest = JSON.parse(new TextDecoder().decode(files["manifest.json"]));
    expect(manifest).toMatchObject({
      format: "avsw-project",
      formatVersion: PROJECT_FORMAT_VERSION,
      appVersion: "0.2.0",
    });
    expect(Object.keys(files).filter((name) => name.startsWith("drawings/"))).toHaveLength(2);
  });

  it("fills in fields that older files did not have", () => {
    const project = sampleProject();
    const files = unzipSync(serializeProject(project));
    const json = JSON.parse(new TextDecoder().decode(files["project.json"]));
    delete json.tools.cableRuns;
    delete json.survey.notes;
    delete json.draft;
    files["project.json"] = strToU8(JSON.stringify(json));

    const restored = parseProject(zipSync(files));
    expect(restored.tools.cableRuns).toEqual([]);
    expect(restored.survey.notes).toBe("");
    expect(restored.draft).toEqual([]);
  });
});

describe("parseProject errors", () => {
  const expectError = (bytes: Uint8Array, message: RegExp) => {
    expect(() => parseProject(bytes)).toThrow(ProjectFileError);
    expect(() => parseProject(bytes)).toThrow(message);
  };

  it("rejects files that are not project files", () => {
    expectError(strToU8("%PDF-1.4 not a zip"), /not an AV-SW project file/);
    expectError(zipSync({ "readme.txt": strToU8("hello") }), /missing manifest.json/);
  });

  it("rejects projects saved by a newer version", () => {
    const files = unzipSync(serializeProject(sampleProject()));
    files["manifest.json"] = strToU8(
      JSON.stringify({ format: "avsw-project", formatVersion: PROJECT_FORMAT_VERSION + 1, appVersion: "9.0.0" }),
    );
    expectError(zipSync(files), /newer version of AV-SW \(9.0.0\)/);
  });

  it("reports a missing drawing by name", () => {
    const files = unzipSync(serializeProject(sampleProject()));
    for (const name of Object.keys(files)) if (name.endsWith(".pdf")) delete files[name];
    expectError(zipSync(files), /"E-101 Lighting.pdf" is missing/);
  });

  it("reports damaged project data", () => {
    const files = unzipSync(serializeProject(sampleProject()));
    files["project.json"] = strToU8(JSON.stringify({ id: "x", name: "Broken", mode: "sideways" }));
    expectError(zipSync(files), /project data is damaged/);
  });
});

describe("helpers", () => {
  it("names projects after their file", () => {
    expect(projectNameFromPath("C:\\Jobs\\Smith Residence.avsw")).toBe("Smith Residence");
    expect(projectNameFromPath("/Users/me/Beach House.AVSW")).toBe("Beach House");
  });

  it("only accepts PDF and DXF drawings", () => {
    expect(() => newDrawing("plan.dwg", new Uint8Array())).toThrow(/not a PDF or DXF/);
  });
});

describe("damaged values inside a project", () => {
  function withProjectJson(edit: (json: Record<string, any>) => void) {
    const files = unzipSync(serializeProject(sampleProject()));
    const json = JSON.parse(new TextDecoder().decode(files["project.json"]));
    edit(json);
    files["project.json"] = strToU8(JSON.stringify(json));
    return zipSync(files);
  }

  it("resets wrong-typed fields to defaults and reports them, so the BOM still builds", () => {
    const bytes = withProjectJson((json) => {
      json.tools.qtlRuns[0].lengthFt = "bad";
      json.tools.network.cameras = null;
      json.survey.speakerCount = "six";
      json.tools.budget.allocations.Audio = "lots";
    });
    const { project, repairs } = parseProjectWithRepairs(bytes);

    expect(new Set(repairs)).toEqual(
      new Set(["survey.speakerCount", "tools.network.cameras", "tools.budget.allocations.Audio", "tools.qtlRuns[0].lengthFt"]),
    );
    expect(project.tools.qtlRuns[0]).toMatchObject({ room: "Kitchen", lengthFt: 10 });
    expect(project.survey.speakerCount).toBe(0);
    expect(() => generateToolBom(project.tools, project.mode)).not.toThrow();
  });

  it("drops invalid draft recommendations and non-object list items", () => {
    const bytes = withProjectJson((json) => {
      json.draft = [
        { id: "d1", system: "Lighting", title: "Ok", rationale: "Fine", confidence: "High" },
        { id: "d2", system: "Plumbing", title: "Bad", rationale: "Unknown system", confidence: "High" },
      ];
      json.tools.audioZones = [42];
    });
    const { project, repairs } = parseProjectWithRepairs(bytes);
    expect(project.draft.map((item) => item.id)).toEqual(["d1"]);
    expect(project.tools.audioZones).toEqual([]);
    expect(repairs).toEqual(expect.arrayContaining(["draft[1]", "tools.audioZones[0]"]));
  });

  it("reports nothing for a healthy file", () => {
    expect(parseProjectWithRepairs(serializeProject(sampleProject())).repairs).toEqual([]);
  });
});

describe("floor plan design in the project file", () => {
  it("round-trips placed devices, runs and sheet scales", () => {
    const project = sampleProject();
    const drawingId = project.drawings[0].id;
    const shared = { drawingId, page: 1, room: "KITCHEN", brand: "Lutron", model: "", notes: "", cableType: "CAT6A", quantity: 1 };
    const withDesign = {
      ...project,
      design: {
        ...project.design,
        items: [
          { ...shared, id: "k1", typeId: "keypad", tag: "KP-1", kind: "device" as const, at: { x: 12, y: 34 }, rotation: 90 },
          { ...shared, id: "c1", typeId: "cable-run", tag: "CBL-1", kind: "run" as const, points: [{ x: 0, y: 0 }, { x: 120, y: 0 }] },
        ],
        scales: [{ drawingId, page: 1, unitsPerFoot: 12, label: "Inches" }],
      },
    };
    const { project: restored, repairs } = parseProjectWithRepairs(serializeProject(withDesign));
    expect(restored.design).toEqual(withDesign.design);
    expect(repairs).toEqual([]);
  });

  it("opens version 1 files (saved before the editor) with an empty design", () => {
    const files = unzipSync(serializeProject(sampleProject()));
    files["manifest.json"] = strToU8(JSON.stringify({ format: "avsw-project", formatVersion: 1 }));
    const json = JSON.parse(new TextDecoder().decode(files["project.json"]));
    delete json.design;
    files["project.json"] = strToU8(JSON.stringify(json));
    const { project, repairs } = parseProjectWithRepairs(zipSync(files));
    expect(project.design.items).toEqual([]);
    expect(project.design.layers.length).toBeGreaterThan(0);
    expect(repairs).toEqual([]);
  });
});
