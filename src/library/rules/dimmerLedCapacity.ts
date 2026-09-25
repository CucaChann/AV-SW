import type { DimmerLedCapacityRule, SourceRef } from "../schema";
import { isVerified, numberSpec, type SpecCarrier } from "../query";

export type DimmerLedCapacityBasis =
  | "published-led-rating"
  | "derated-incandescent-rating"
  | "no-rating";

export type DimmerLedCapacityResult = {
  ruleId: string;
  basis: DimmerLedCapacityBasis;
  capacityW: number | null;
  loadPerUnitW: number | null;
  totalLoadW: number | null;
  maxUnits: number | null;
  /** null when capacity or load is unknown. */
  withinCapacity: boolean | null;
  /** True only when the rule, dimmer and load records are all verified. */
  verified: boolean;
  explanation: string;
  sources: SourceRef[];
};

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * How many LED loads a dimmer can carry. Uses the dimmer's published LED
 * rating when it has one; otherwise its incandescent rating multiplied by the
 * rule's derating factor.
 */
export function evaluateDimmerLedCapacity(input: {
  rule: DimmerLedCapacityRule;
  dimmer: SpecCarrier;
  load: SpecCarrier;
  quantity: number;
}): DimmerLedCapacityResult {
  const { rule, dimmer, load, quantity } = input;
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new RangeError(`quantity must be a non-negative integer, got ${quantity}`);
  }

  const sources: SourceRef[] = [rule.source];
  const notes: string[] = [];

  const ledRating = numberSpec(dimmer, "dimming.ratedLoadLedW");
  const incandescentRating = numberSpec(dimmer, "dimming.ratedLoadIncandescentW");
  const factor = rule.params.deratingWithoutLedRating;

  let basis: DimmerLedCapacityBasis = "no-rating";
  let capacityW: number | null = null;

  if (ledRating) {
    basis = "published-led-rating";
    capacityW = ledRating.value;
    sources.push(ledRating.fact.source);
    notes.push(`${dimmer.id} publishes an LED rating of ${round(capacityW)} W.`);
  } else if (incandescentRating) {
    basis = "derated-incandescent-rating";
    capacityW = incandescentRating.value * factor;
    sources.push(incandescentRating.fact.source);
    notes.push(
      `${dimmer.id} has no published LED rating; its ${round(incandescentRating.value)} W rating is held to ${round(factor * 100)}% = ${round(capacityW)} W (${rule.id}).`,
    );
  } else {
    notes.push(`${dimmer.id} has no LED or incandescent rating in the library; capacity cannot be checked.`);
  }

  const perUnit = numberSpec(load, "led.inputPowerW");
  const loadPerUnitW = perUnit?.value ?? null;
  if (perUnit) {
    sources.push(perUnit.fact.source);
  } else {
    notes.push(`${load.id} has no input power in the library; load cannot be checked.`);
  }

  const totalLoadW = loadPerUnitW === null ? null : loadPerUnitW * quantity;
  const maxUnits =
    capacityW === null || !loadPerUnitW ? null : Math.floor(capacityW / loadPerUnitW + 1e-9);
  const withinCapacity =
    capacityW === null || totalLoadW === null ? null : totalLoadW <= capacityW + 1e-9;

  if (totalLoadW !== null && capacityW !== null) {
    notes.push(
      `${quantity} × ${round(loadPerUnitW ?? 0)} W = ${round(totalLoadW)} W of ${round(capacityW)} W; up to ${maxUnits} units fit.`,
    );
  }

  const verified = isVerified(rule) && isVerified(dimmer) && isVerified(load);
  if (!verified) notes.push("Uses unverified library data; confirm against the sources before issuing.");

  return {
    ruleId: rule.id,
    basis,
    capacityW,
    loadPerUnitW,
    totalLoadW,
    maxUnits,
    withinCapacity,
    verified,
    explanation: notes.join(" "),
    sources,
  };
}
