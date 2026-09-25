import { describe, expect, it } from "vitest";
import { DEFAULT_RETROFIT_SURVEY } from "./design";
import { defaultDesign } from "./planDesign";
import { cableRunTotal, DEFAULT_TOOLS_STATE, generateToolBom, issueSummary, newCableRun, normalizeTools, validateProject } from "./projectTools";

const validate = (tools = DEFAULT_TOOLS_STATE) =>
  validateProject({ bom: [], mode: "new-build", survey: DEFAULT_RETROFIT_SURVEY, tools });

describe("issueSummary", () => {
  it("reports a clear project only when there are no blockers or warnings", () => {
    const summary = issueSummary(validate());
    expect(summary.blockers).toBe(0);
    expect(summary.warnings).toBe(0);
    expect(summary.headline).toBe("No blockers or warnings from the current checks.");
  });

  it("surfaces an over-budget blocker first", () => {
    const tools = {
      ...DEFAULT_TOOLS_STATE,
      budget: {
        ...DEFAULT_TOOLS_STATE.budget,
        total: 1000,
        allocations: { ...DEFAULT_TOOLS_STATE.budget.allocations, Network: 5000 },
      },
    };
    const summary = issueSummary(validate(tools));
    expect(summary.blockers).toBe(1);
    expect(summary.headline).toBe("1 blocker");
    expect(summary.actionable[0]).toMatchObject({ severity: "Blocker", system: "Budget" });
  });

  it("counts warnings and pluralizes", () => {
    const tools = { ...DEFAULT_TOOLS_STATE, network: { ...DEFAULT_TOOLS_STATE.network, rackLocations: 0 } };
    const issues = [
      ...validate(tools),
      { id: "x", severity: "Warning" as const, system: "Test", message: "Second warning" },
    ];
    expect(issueSummary(issues).headline).toBe("2 warnings");
  });
});

describe("normalizeTools", () => {
  it("fills fields missing from older saved items so the BOM can be built", () => {
    const tools = normalizeTools({
      qtlRuns: [{ id: "legacy-1", room: "Kitchen", lengthFt: 8, wattsPerFt: 4 }, null, "junk"],
      audioZones: [{ room: "Den" }],
      cableRuns: "not a list",
    });
    expect(tools.qtlRuns).toHaveLength(1);
    expect(tools.qtlRuns[0]).toMatchObject({
      id: "legacy-1",
      room: "Kitchen",
      selectedFamily: expect.any(String),
      planItemId: "",
    });
    expect(tools.audioZones[0]).toMatchObject({ room: "Den", speakerType: "In-Ceiling" });
    expect(tools.cableRuns).toEqual([]);
    expect(() => generateToolBom(tools, "new-build")).not.toThrow();
  });
});

describe("cableRunTotal", () => {
  it("does not add a foot for floating-point noise", () => {
    const run = { ...newCableRun(), measuredFt: 50, verticalAllowanceFt: 10, serviceLoopPct: 10, wastePct: 10, quantity: 1 };
    expect(cableRunTotal(run)).toBe(72);
    expect(cableRunTotal({ ...run, measuredFt: 50.5 })).toBe(73);
  });
});

describe("validateProject with a floor plan", () => {
  it("warns about carried items whose alignment isn't verified", () => {
    const keypad = {
      id: "k1", typeId: "keypad", drawingId: "d2", page: 1, tag: "KP-1", room: "", brand: "", model: "",
      notes: "", cableType: "CAT6A", quantity: 1, kind: "device" as const, at: { x: 0, y: 0 }, rotation: 0,
    };
    const design = {
      ...defaultDesign(),
      items: [keypad],
      unverifiedSheets: [
        { drawingId: "d2", page: 1, reason: "Carried over from the previous PDF." },
        // A marked sheet with nothing on it is not worth a warning.
        { drawingId: "d2", page: 2, reason: "Carried over from the previous PDF." },
      ],
    };
    const issues = validateProject({
      bom: [], mode: "new-build", survey: DEFAULT_RETROFIT_SURVEY, tools: DEFAULT_TOOLS_STATE, design,
    }).filter((issue) => issue.system === "Floor Plan");
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: "Warning", message: expect.stringContaining("Page 1: 1 placed item") });
  });
});
