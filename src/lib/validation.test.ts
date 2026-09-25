import { describe, expect, it } from "vitest";
import { DEFAULT_RETROFIT_SURVEY } from "./design";
import { DEFAULT_TOOLS_STATE, issueSummary, validateProject } from "./projectTools";

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
