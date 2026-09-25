import type { PlacedRun, PlanDesign } from "./planDesign";
import { newQtlRun, type QtlRun } from "./projectTools";

/** Plan lines are drawn by hand; differences under an inch are drawing noise. */
export const PLAN_LENGTH_TOLERANCE_FT = 1 / 12;

export function qtlRunForPlanItem(runs: QtlRun[], itemId: string) {
  return runs.find((run) => run.planItemId === itemId);
}

/** Plan item ids that a QTL run already covers, so the plan BOM doesn't count them twice. */
export function linkedPlanItemIds(runs: QtlRun[], design: PlanDesign) {
  const present = new Set(design.items.map((item) => item.id));
  return new Set(runs.map((run) => run.planItemId).filter((id) => id && present.has(id)));
}

/** A new QTL run for a drawn linear-light line: one fixture the measured length. */
export function qtlRunFromPlanLine(item: PlacedRun, lengthFt: number): QtlRun {
  return {
    ...newQtlRun(),
    room: item.room,
    // The plan knows where the light goes, not what it lights; leave that to the designer.
    application: "",
    lengthFt,
    planItemId: item.id,
    notes: item.tag ? `Plan line ${item.tag}.` : "",
  };
}

/** Total fixture length of a run (all fixtures together). */
export function qtlRunTotalFt(run: QtlRun) {
  return run.lengthFt * Math.max(1, run.fixtureQty);
}

/** Plan length minus the run's total when they differ by more than drawing noise, else null. */
export function planLengthDifference(run: QtlRun, planFt: number) {
  const difference = planFt - qtlRunTotalFt(run);
  return Math.abs(difference) > PLAN_LENGTH_TOLERANCE_FT ? difference : null;
}

/** Fit the run to the plan length, keeping its fixture count. */
export function fitRunToPlan(run: QtlRun, planFt: number): Partial<QtlRun> {
  return { lengthFt: planFt / Math.max(1, run.fixtureQty) };
}
