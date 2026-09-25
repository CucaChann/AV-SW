import { describe, expect, it } from "vitest";
import { loadLibrary } from "../load";
import type { Fact, Review } from "../schema";
import type { SpecCarrier } from "../query";
import { evaluateDimmerLedCapacity } from "./dimmerLedCapacity";

// The rule comes from the real library (data/library/dmf.json). Dimmers and
// loads below are synthetic test inputs, not product data.
const rule = loadLibrary().library.rules.find((r) => r.id === "dmf-dimmer-led-derating")!;

const proposed: Review = { status: "proposed", proposedBy: "test", proposedOn: "2026-09-25" };
const verified: Review = {
  status: "verified",
  proposedBy: "test",
  proposedOn: "2026-09-25",
  verifiedBy: "Test Reviewer",
  verifiedOn: "2026-09-25",
};

const watts = (value: number): Fact => ({ value, unit: "W", source: { sourceId: "test" } });

function carrier(id: string, specs: Record<string, Fact>, review = proposed): SpecCarrier {
  return { id, specs, review };
}

const dimmer600 = carrier("test-dimmer-600", { "dimming.ratedLoadIncandescentW": watts(600) });
const module12w5 = carrier("test-module-12w5", { "led.inputPowerW": watts(12.5) });

describe("evaluateDimmerLedCapacity", () => {
  it("derates a dimmer with no LED rating (600 W -> 300 W -> 24 x 12.5 W)", () => {
    const result = evaluateDimmerLedCapacity({ rule, dimmer: dimmer600, load: module12w5, quantity: 24 });
    expect(result).toMatchObject({
      basis: "derated-incandescent-rating",
      capacityW: 300,
      loadPerUnitW: 12.5,
      totalLoadW: 300,
      maxUnits: 24,
      withinCapacity: true,
    });
    expect(result.explanation).toContain("held to 50% = 300 W");
  });

  it("fails one module over capacity", () => {
    const result = evaluateDimmerLedCapacity({ rule, dimmer: dimmer600, load: module12w5, quantity: 25 });
    expect(result.withinCapacity).toBe(false);
    expect(result.totalLoadW).toBe(312.5);
  });

  it("uses a published LED rating instead of derating", () => {
    const dimmer = carrier("test-dimmer-led", {
      "dimming.ratedLoadIncandescentW": watts(600),
      "dimming.ratedLoadLedW": watts(250),
    });
    const result = evaluateDimmerLedCapacity({ rule, dimmer, load: module12w5, quantity: 20 });
    expect(result).toMatchObject({
      basis: "published-led-rating",
      capacityW: 250,
      maxUnits: 20,
      withinCapacity: true,
    });
  });

  it("cannot decide without ratings or load power", () => {
    const noRating = evaluateDimmerLedCapacity({
      rule,
      dimmer: carrier("test-dimmer-unknown", {}),
      load: module12w5,
      quantity: 4,
    });
    expect(noRating).toMatchObject({ basis: "no-rating", capacityW: null, withinCapacity: null });

    const noLoad = evaluateDimmerLedCapacity({
      rule,
      dimmer: dimmer600,
      load: carrier("test-module-unknown", {}),
      quantity: 4,
    });
    expect(noLoad).toMatchObject({ capacityW: 300, totalLoadW: null, withinCapacity: null });
  });

  it("is only verified when the rule, dimmer and load all are", () => {
    const allInputsVerified = evaluateDimmerLedCapacity({
      rule: { ...rule, review: verified },
      dimmer: { ...dimmer600, review: verified },
      load: { ...module12w5, review: verified },
      quantity: 1,
    });
    expect(allInputsVerified.verified).toBe(true);

    const proposedRule = evaluateDimmerLedCapacity({
      rule,
      dimmer: { ...dimmer600, review: verified },
      load: { ...module12w5, review: verified },
      quantity: 1,
    });
    expect(proposedRule.verified).toBe(false);
    expect(proposedRule.explanation).toContain("unverified library data");
  });

  it("rejects invalid quantities", () => {
    expect(() =>
      evaluateDimmerLedCapacity({ rule, dimmer: dimmer600, load: module12w5, quantity: 1.5 }),
    ).toThrow(RangeError);
  });
});
