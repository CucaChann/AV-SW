import { isVerified, numberSpec, type SpecCarrier } from "../query";
import type { PowerSupplyOutputGroupingRule, SourceRef } from "../schema";

export type PowerSupplyGroupingResult = {
  ruleId: string;
  voltageV: number;
  loadsW: number[];
  designReservePct: number;
  selectedCapacityW: number | null;
  outputCount: number | null;
  maxPerOutputW: number | null;
  channelsW: number[][] | null;
  unusedCapacityW: number | null;
  fits: boolean | null;
  compatible: boolean | null;
  compatibilityIssues: string[];
  compatibilityUnknowns: string[];
  verified: boolean;
  explanation: string;
  sources: SourceRef[];
};

type PackingResult =
  | { status: "packed"; channels: number[][] }
  | { status: "impossible"; channels: null }
  | { status: "budget-exhausted"; channels: null };

const round = (value: number) => Math.round(value * 1000) / 1000;

// JS decimal sums can land a few ulps above an exact published boundary.
// A 1e-9 W tolerance absorbs only floating-point noise; real overloads such
// as 96.0004 W remain overloads and are never rounded into compliance.
const CAPACITY_EPSILON_W = 1e-9;
const exceedsCapacity = (value: number, limit: number) =>
  value - limit > CAPACITY_EPSILON_W;

function maxItemsPerOutput(loads: number[], maxPerOutputW: number): number {
  const ascending = [...loads].sort((a, b) => a - b);
  let total = 0;
  let count = 0;
  for (const load of ascending) {
    if (exceedsCapacity(total + load, maxPerOutputW)) break;
    total += load;
    count += 1;
  }
  return count;
}

function packExact(
  loads: number[],
  outputCount: number,
  maxPerOutputW: number,
  nodeBudget = 100_000,
): PackingResult {
  if (maxItemsPerOutput(loads, maxPerOutputW) * outputCount < loads.length) {
    return { status: "impossible", channels: null };
  }

  const indexed = loads
    .map((load, index) => ({ load, index }))
    .sort((a, b) => b.load - a.load || a.index - b.index);

  if (indexed.some(({ load }) => exceedsCapacity(load, maxPerOutputW))) {
    return { status: "impossible", channels: null };
  }

  const channels: Array<Array<{ load: number; index: number }>> = Array.from(
    { length: outputCount },
    () => [],
  );
  const totals = Array(outputCount).fill(0) as number[];
  let placements = 0;
  let exhausted = false;

  function place(position: number): boolean {
    if (position >= indexed.length) return true;
    if (placements >= nodeBudget) {
      exhausted = true;
      return false;
    }

    const entry = indexed[position];
    const seenTotals = new Set<number>();

    for (let channel = 0; channel < outputCount; channel += 1) {
      if (placements >= nodeBudget) {
        exhausted = true;
        return false;
      }

      const current = totals[channel];
      // This is only symmetry pruning; capacity decisions always use full precision.
      const symmetryKey = round(current);
      if (seenTotals.has(symmetryKey)) continue;
      seenTotals.add(symmetryKey);

      if (current + entry.exceedsCapacity(load, maxPerOutputW)) continue;

      placements += 1;
      channels[channel].push(entry);
      totals[channel] += entry.load;
      if (place(position + 1)) return true;
      totals[channel] -= entry.load;
      channels[channel].pop();

      if (current === 0) break;
    }
    return false;
  }

  if (!place(0)) {
    return exhausted
      ? { status: "budget-exhausted", channels: null }
      : { status: "impossible", channels: null };
  }

  return {
    status: "packed",
    channels: channels
      .filter((channel) => channel.length > 0)
      .map((channel) =>
        channel
          .sort((a, b) => a.index - b.index)
          .map(({ load }) => load),
      ),
  };
}

function phaseEdgeIsUnknown(requested: string, published: string[]) {
  return (
    (requested === "forward-phase" || requested === "reverse-phase") &&
    published.includes("phase") &&
    !published.includes(requested)
  );
}

/**
 * Finds the smallest published power-supply configuration that can carry all
 * entered loads without exceeding either total capacity or any individual
 * output's Class 2 limit. designReservePct is a designer policy, not a QTL fact.
 */
export function evaluatePowerSupplyOutputGrouping(input: {
  rule: PowerSupplyOutputGroupingRule;
  loadsW: number[];
  voltageV: number;
  /** The selected PSU family record, used for sourced voltage/control/environment checks. */
  powerSupply?: SpecCarrier;
  dimmingMethod?: string;
  environment?: string;
  designReservePct?: number;
}): PowerSupplyGroupingResult {
  const { rule, voltageV, powerSupply } = input;
  // Keep engineering values at full precision. round() is presentation-only.
  const loadsW = [...input.loadsW];
  const designReservePct = input.designReservePct ?? 0;

  if (!Number.isFinite(voltageV) || voltageV <= 0) {
    throw new RangeError(`voltageV must be greater than zero, got ${voltageV}`);
  }
  if (
    loadsW.length === 0 ||
    loadsW.some((load) => !Number.isFinite(load) || load <= 0)
  ) {
    throw new RangeError("loadsW must contain one or more positive finite loads");
  }
  if (
    !Number.isFinite(designReservePct) ||
    designReservePct < 0 ||
    designReservePct >= 100
  ) {
    throw new RangeError(
      `designReservePct must be at least 0 and below 100, got ${designReservePct}`,
    );
  }

  const sources: SourceRef[] = [rule.source];
  const compatibilityIssues: string[] = [];
  const compatibilityUnknowns: string[] = [];

  if (powerSupply) {
    const outputVoltage = numberSpec(powerSupply, "electrical.outputVoltageV");
    if (!outputVoltage) {
      compatibilityUnknowns.push(
        `unknown: ${powerSupply.id} has no electrical.outputVoltageV fact in the library`,
      );
    } else {
      sources.push(outputVoltage.fact.source);
      if (Math.abs(outputVoltage.value - voltageV) > Number.EPSILON) {
        compatibilityIssues.push(
          `${powerSupply.id} publishes ${outputVoltage.value} V output; the run group is ${voltageV} V.`,
        );
      }
    }

    if (input.dimmingMethod) {
      const dimming = powerSupply.specs["dimming.methods"];
      if (!dimming || !Array.isArray(dimming.value)) {
        compatibilityUnknowns.push(
          `unknown: ${powerSupply.id} has no dimming.methods fact in the library`,
        );
      } else {
        sources.push(dimming.source);
        if (phaseEdgeIsUnknown(input.dimmingMethod, dimming.value)) {
          compatibilityUnknowns.push(
            `unknown: ${powerSupply.id} publishes generic phase control but does not state whether ${input.dimmingMethod} is supported`,
          );
        } else if (!dimming.value.includes(input.dimmingMethod)) {
          compatibilityIssues.push(
            `${powerSupply.id} does not list ${input.dimmingMethod} control; published methods are ${dimming.value.join(", ")}.`,
          );
        }
      }
    }

    if (input.environment) {
      const environments = powerSupply.specs["environment.ratings"];
      if (!environments || !Array.isArray(environments.value)) {
        compatibilityUnknowns.push(
          `unknown: ${powerSupply.id} has no environment.ratings fact in the library`,
        );
      } else {
        sources.push(environments.source);
        if (!environments.value.includes(input.environment)) {
          compatibilityIssues.push(
            `${powerSupply.id} does not list the ${input.environment} environment; published ratings are ${environments.value.join(", ")}.`,
          );
        }
      }
    }
  }

  const verified = isVerified(rule) && (!powerSupply || isVerified(powerSupply));
  const compatible = powerSupply
    ? compatibilityIssues.length > 0
      ? false
      : compatibilityUnknowns.length > 0
        ? null
        : true
    : null;

  if (compatibilityIssues.length > 0) {
    const explanation =
      `Selected PSU family is incompatible with the entered run-group requirements: ${compatibilityIssues.join(" ")}`;
    return {
      ruleId: rule.id,
      voltageV,
      loadsW,
      designReservePct,
      selectedCapacityW: null,
      outputCount: null,
      maxPerOutputW: null,
      channelsW: null,
      unusedCapacityW: null,
      fits: false,
      compatible,
      compatibilityIssues,
      compatibilityUnknowns,
      verified,
      explanation: verified
        ? explanation
        : `${explanation} Uses proposed library data; confirm the cited source before issuing.`,
      sources,
    };
  }

  if (Math.abs(voltageV - rule.params.voltageV) > Number.EPSILON) {
    const explanation =
      `This rule is published for ${rule.params.voltageV} V loads, not ${voltageV} V; AV-SW cannot select a power supply from it.`;
    return {
      ruleId: rule.id,
      voltageV,
      loadsW,
      designReservePct,
      selectedCapacityW: null,
      outputCount: null,
      maxPerOutputW: null,
      channelsW: null,
      unusedCapacityW: null,
      fits: false,
      compatible,
      compatibilityIssues,
      compatibilityUnknowns,
      verified,
      explanation,
      sources,
    };
  }

  const totalLoadW = loadsW.reduce((sum, load) => sum + load, 0);
  const usableFactor = 1 - designReservePct / 100;
  const configurations = [...rule.params.configurations].sort(
    (a, b) =>
      a.totalCapacityW - b.totalCapacityW ||
      a.outputCount - b.outputCount ||
      a.maxPerOutputW - b.maxPerOutputW,
  );
  let budgetExhausted = false;

  for (const configuration of configurations) {
    const usableTotalCapacityW = configuration.totalCapacityW * usableFactor;
    const usablePerOutputW = configuration.maxPerOutputW * usableFactor;
    if (exceedsCapacity(totalLoadW, usableTotalCapacityW)) continue;

    const packing = packExact(
      loadsW,
      configuration.outputCount,
      usablePerOutputW,
    );
    if (packing.status === "budget-exhausted") {
      budgetExhausted = true;
      continue;
    }
    if (packing.status !== "packed") continue;

    const reserveNote =
      designReservePct > 0
        ? ` A designer-set ${designReservePct}% reserve is applied; this is project policy, not a QTL manufacturer requirement.`
        : "";
    const unknownNote =
      compatibilityUnknowns.length > 0
        ? ` Compatibility still needs review: ${compatibilityUnknowns.join(" ")}`
        : "";
    const base =
      `${round(totalLoadW)} W fits the published ${configuration.totalCapacityW} W configuration across ` +
      `${configuration.outputCount} output${configuration.outputCount === 1 ? "" : "s"} ` +
      `(${configuration.maxPerOutputW} W published maximum per output).${reserveNote}${unknownNote}`;

    return {
      ruleId: rule.id,
      voltageV,
      loadsW,
      designReservePct,
      selectedCapacityW: configuration.totalCapacityW,
      outputCount: configuration.outputCount,
      maxPerOutputW: configuration.maxPerOutputW,
      channelsW: packing.channels,
      unusedCapacityW: round(usableTotalCapacityW - totalLoadW),
      fits: compatibilityUnknowns.length > 0 ? null : true,
      compatible,
      compatibilityIssues,
      compatibilityUnknowns,
      verified,
      explanation: verified
        ? base
        : `${base} Uses proposed library data; confirm the cited source before issuing.`,
      sources,
    };
  }

  const largestOutput = Math.max(
    ...configurations.map((configuration) => configuration.maxPerOutputW * usableFactor),
  );
  const overOutput = loadsW.find((load) => exceedsCapacity(load, largestOutput));
  const reason = budgetExhausted
    ? "AV-SW reached its safe packing-search budget and could not prove a valid output grouping; split the run group or review it manually."
    : overOutput
      ? `At least one load is ${round(overOutput)} W, above the largest usable per-output limit of ${round(largestOutput)} W in this rule.`
      : `No published configuration in this rule can pack ${round(totalLoadW)} W across its available outputs.`;

  return {
    ruleId: rule.id,
    voltageV,
    loadsW,
    designReservePct,
    selectedCapacityW: null,
    outputCount: null,
    maxPerOutputW: null,
    channelsW: null,
    unusedCapacityW: null,
    fits: budgetExhausted ? null : false,
    compatible,
    compatibilityIssues,
    compatibilityUnknowns,
    verified,
    explanation: verified
      ? reason
      : `${reason} Uses proposed library data; confirm the cited source before issuing.`,
    sources,
  };
}
