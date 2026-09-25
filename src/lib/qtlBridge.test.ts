import { describe, expect, it } from "vitest";
import { defaultDesign, type PlacedRun } from "./planDesign";
import { newQtlRun } from "./projectTools";
import {
  fitRunToPlan,
  linkedPlanItemIds,
  planLengthDifference,
  qtlRunForPlanItem,
  qtlRunFromPlanLine,
} from "./qtlBridge";

const line = (id: string, extra: Partial<PlacedRun> = {}): PlacedRun => ({
  id,
  typeId: "linear-light",
  drawingId: "d1",
  page: 1,
  tag: "LN1",
  room: "KITCHEN",
  brand: "QTL",
  model: "",
  notes: "",
  cableType: "CAT6A",
  quantity: 1,
  kind: "run",
  points: [{ x: 0, y: 0 }, { x: 147, y: 0 }],
  ...extra,
});

describe("qtlRunFromPlanLine", () => {
  it("starts a linked run with the plan's room and measured length", () => {
    const run = qtlRunFromPlanLine(line("p1"), 12.349);
    expect(run).toMatchObject({
      room: "KITCHEN",
      planItemId: "p1",
      fixtureQty: 1,
      // Rounded down to 0.01 ft so the run never claims more than was drawn.
      lengthFt: 12.34,
      application: "",
      notes: "Plan line LN1.",
    });
  });
});

describe("linkedPlanItemIds", () => {
  it("only counts links to lines still on the plan", () => {
    const design = { ...defaultDesign(), items: [line("p1"), line("p2")] };
    const runs = [
      { ...newQtlRun(), planItemId: "p1" },
      { ...newQtlRun(), planItemId: "deleted" },
      newQtlRun(),
    ];
    expect([...linkedPlanItemIds(runs, design)]).toEqual(["p1"]);
    expect(qtlRunForPlanItem(runs, "p1")).toBe(runs[0]);
    expect(qtlRunForPlanItem(runs, "p2")).toBeUndefined();
  });
});

describe("plan length checks", () => {
  it("ignores differences under an inch", () => {
    const run = { ...newQtlRun(), lengthFt: 6, fixtureQty: 2 };
    expect(planLengthDifference(run, 12.05)).toBeNull();
    expect(planLengthDifference(run, 12.5)).toBeCloseTo(0.5);
    expect(planLengthDifference(run, 11)).toBeCloseTo(-1);
  });

  it("fits the run to the plan keeping the fixture count", () => {
    const run = { ...newQtlRun(), lengthFt: 6, fixtureQty: 3 };
    expect(fitRunToPlan(run, 20)).toEqual({ lengthFt: 6.66 });
    expect(planLengthDifference({ ...run, ...fitRunToPlan(run, 20) }, 20)).toBeNull();
  });
});
