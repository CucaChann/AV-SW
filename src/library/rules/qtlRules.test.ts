import { describe, expect, it } from "vitest";
import { loadLibrary } from "../load";
import type {
  LinearOrderingRule,
  PowerSupplyOutputGroupingRule,
  VoltageDropGuidanceRule,
} from "../schema";
import { evaluateLinearOrdering } from "./linearOrdering";
import { evaluatePowerSupplyOutputGrouping } from "./powerSupplyOutputGrouping";
import { evaluateVoltageDropGuidance } from "./voltageDropGuidance";

const library = loadLibrary();
const rule = <T>(id: string) =>
  library.library.rules.find((candidate) => candidate.id === id) as T;

const kurv = rule<LinearOrderingRule>("qtl-kurv-linear-ordering");
const vers = rule<LinearOrderingRule>("qtl-vers-flush-02-linear-ordering");
const qzPro = rule<PowerSupplyOutputGroupingRule>("qtl-qz-pro-output-grouping");
const voltage = rule<VoltageDropGuidanceRule>("qtl-24v-voltage-drop-guidance");

describe("QTL linear ordering", () => {
  it("splits a 240 in KURV SW request into exact orderable pieces", () => {
    const result = evaluateLinearOrdering({
      rule: kurv,
      requestedTotalIn: 240,
      variant: "static-white",
    });

    expect(result.orderable).toBe(true);
    expect(result.segmentsIn).toEqual([120, 120]);
    expect(result.segmentsIn!.reduce((sum, value) => sum + value, 0)).toBe(240);
    expect(result.segmentsIn!.every((value) => value <= 191)).toBe(true);
  });

  it("preserves a non-even total across the minimum number of pieces", () => {
    const result = evaluateLinearOrdering({
      rule: kurv,
      requestedTotalIn: 383,
      variant: "static-white",
    });

    expect(result.orderable).toBe(true);
    expect(result.segmentsIn).toHaveLength(3);
    expect(result.segmentsIn!.reduce((sum, value) => sum + value, 0)).toBe(383);
    expect(result.segmentsIn!.every((value) => value >= 12 && value <= 191)).toBe(true);
  });

  it("does not pretend an odd SW-HE total is orderable on a 2 in increment", () => {
    const result = evaluateLinearOrdering({
      rule: kurv,
      requestedTotalIn: 241,
      variant: "static-white-he",
    });

    expect(result.orderable).toBe(false);
    expect(result.segmentsIn).toBeNull();
    expect(result.nearestLowerTotalIn).toBe(240);
    expect(result.nearestUpperTotalIn).toBe(242);
  });

  it("enforces VERS min/max without inventing an unpublished increment", () => {
    const result = evaluateLinearOrdering({
      rule: vers,
      requestedTotalIn: 240,
      variant: "default",
    });

    expect(result.orderable).toBeNull();
    expect(result.minimumPieces).toBe(3);
    expect(result.segmentsIn).toBeNull();
    expect(result.explanation).toContain("will not invent segment lengths");
  });

  it("returns cannot-check for a light engine with no published rule", () => {
    const result = evaluateLinearOrdering({
      rule: kurv,
      requestedTotalIn: 100,
      variant: "rgbw",
    });

    expect(result.orderable).toBeNull();
    expect(result.minLengthIn).toBeNull();
  });
});

describe("QTL QZ output grouping", () => {
  it("uses one 96 W output for 50 W + 40 W", () => {
    const result = evaluatePowerSupplyOutputGrouping({
      rule: qzPro,
      voltageV: 24,
      loadsW: [50, 40],
    });

    expect(result.fits).toBe(true);
    expect(result.selectedCapacityW).toBe(96);
    expect(result.outputCount).toBe(1);
    expect(result.channelsW).toEqual([[50, 40]]);
  });

  it("uses 192 W as two independent 96 W outputs", () => {
    const result = evaluatePowerSupplyOutputGrouping({
      rule: qzPro,
      voltageV: 24,
      loadsW: [70, 70],
    });

    expect(result.fits).toBe(true);
    expect(result.selectedCapacityW).toBe(192);
    expect(result.channelsW).toEqual([[70], [70]]);
  });

  it("rejects a 97 W single load even though larger total nameplate sizes exist", () => {
    const result = evaluatePowerSupplyOutputGrouping({
      rule: qzPro,
      voltageV: 24,
      loadsW: [97],
    });

    expect(result.fits).toBe(false);
    expect(result.selectedCapacityW).toBeNull();
    expect(result.explanation).toContain("per-output limit");
  });

  it("uses three outputs for three 80 W loads", () => {
    const result = evaluatePowerSupplyOutputGrouping({
      rule: qzPro,
      voltageV: 24,
      loadsW: [80, 80, 80],
    });

    expect(result.fits).toBe(true);
    expect(result.selectedCapacityW).toBe(288);
    expect(result.channelsW).toEqual([[80], [80], [80]]);
  });
});

describe("QTL voltage-drop guidance", () => {
  it("computes current and the 3% limit for a 60 W / 24 V load", () => {
    const result = evaluateVoltageDropGuidance({
      rule: voltage,
      loadWatts: 60,
    });

    expect(result.currentA).toBe(2.5);
    expect(result.targetDropPercent).toBe(3);
    expect(result.maxDropV).toBe(0.72);
    expect(result.withinTarget).toBeNull();
  });

  it("passes and fails entered drops against the same sourced target", () => {
    const pass = evaluateVoltageDropGuidance({
      rule: voltage,
      loadWatts: 60,
      estimatedDropV: 0.5,
    });
    const fail = evaluateVoltageDropGuidance({
      rule: voltage,
      loadWatts: 60,
      estimatedDropV: 1,
    });

    expect(pass.withinTarget).toBe(true);
    expect(fail.withinTarget).toBe(false);
  });

  it("uses the published dimmer calculation factor without inventing conductor data", () => {
    const result = evaluateVoltageDropGuidance({
      rule: voltage,
      loadWatts: 60,
      dimmerMode: true,
    });

    expect(result.calculationVoltageV).toBe(22.008);
    expect(result.currentA).toBeCloseTo(2.726, 3);
    expect(result.explanation).toContain("cannot pass/fail");
  });
});
