import { isVerified } from "../query";
import type { PowerSupplyOutputGroupingRule, SourceRef } from "../schema";

export type PowerSupplyGroupingResult = {
  ruleId: string;
  voltageV: number;
  loadsW: number[];
  selectedCapacityW: number | null;
  outputCount: number | null;
  maxPerOutputW: number | null;
  channelsW: number[][] | null;
  unusedCapacityW: number | null;
  fits: boolean;
  verified: boolean;
  explanation: string;
  sources: SourceRef[];
};

const round = (value: number) => Math.round(value * 1000) / 1000;

function packExact(loads: number[], outputCount: number, maxPerOutputW: number): number[][] | null {
  const indexed = loads
    .map((load, index) => ({ load, index }))
    .sort((a, b) => b.load - a.load || a.index - b.index);

  if (indexed.some(({ load }) => load > maxPerOutputW + 1e-9)) return null;

  const channels: Array<Array<{ load: number; index: number }>> = Array.from(
    { length: outputCount },
    () => [],
  );
  const totals = Array(outputCount).fill(0) as number[];

  function place(position: number): boolean {
    if (position >= indexed.length) return true;
    const entry = indexed[position];
    const seenTotals = new Set<number>();

    for (let channel = 0; channel < outputCount; channel += 1) {
      const current = totals[channel];
      const roundedCurrent = round(current);
      if (seenTotals.has(roundedCurrent)) continue;
      seenTotals.add(roundedCurrent);

      if (current + entry.load > maxPerOutputW + 1e-9) continue;

      channels[channel].push(entry);
      totals[channel] += entry.load;
      if (place(position + 1)) return true;
      totals[channel] -= entry.load;
      channels[channel].pop();

      if (current === 0) break;
    }
    return false;
  }

  if (!place(0)) return null;

  return channels
    .filter((channel) => channel.length > 0)
    .map((channel) =>
      channel
        .sort((a, b) => a.index - b.index)
        .map(({ load }) => load),
    );
}

/**
 * Finds the smallest published power-supply configuration that can carry all
 * entered loads without exceeding either total capacity or any individual
 * output's Class 2 limit. No unsourced reserve or derating is applied.
 */
export function evaluatePowerSupplyOutputGrouping(input: {
  rule: PowerSupplyOutputGroupingRule;
  loadsW: number[];
  voltageV: number;
}): PowerSupplyGroupingResult {
  const { rule, voltageV } = input;
  const loadsW = input.loadsW.map(round);

  if (!Number.isFinite(voltageV) || voltageV <= 0) {
    throw new RangeError(`voltageV must be greater than zero, got ${voltageV}`);
  }
  if (
    loadsW.length === 0 ||
    loadsW.some((load) => !Number.isFinite(load) || load <= 0)
  ) {
    throw new RangeError("loadsW must contain one or more positive finite loads");
  }

  const verified = isVerified(rule);
  const sources = [rule.source];

  if (Math.abs(voltageV - rule.params.voltageV) > 1e-9) {
    const explanation =
      `This rule is published for ${rule.params.voltageV} V loads, not ${voltageV} V; AV-SW cannot select a power supply from it.`;
    return {
      ruleId: rule.id,
      voltageV,
      loadsW,
      selectedCapacityW: null,
      outputCount: null,
      maxPerOutputW: null,
      channelsW: null,
      unusedCapacityW: null,
      fits: false,
      verified,
      explanation,
      sources,
    };
  }

  const totalLoadW = loadsW.reduce((sum, load) => sum + load, 0);
  const configurations = [...rule.params.configurations].sort(
    (a, b) =>
      a.totalCapacityW - b.totalCapacityW ||
      a.outputCount - b.outputCount ||
      a.maxPerOutputW - b.maxPerOutputW,
  );

  for (const configuration of configurations) {
    if (totalLoadW > configuration.totalCapacityW + 1e-9) continue;
    const channels = packExact(
      loadsW,
      configuration.outputCount,
      configuration.maxPerOutputW,
    );
    if (!channels) continue;

    const base =
      `${round(totalLoadW)} W fits the published ${configuration.totalCapacityW} W configuration across ` +
      `${configuration.outputCount} output${configuration.outputCount === 1 ? "" : "s"} ` +
      `(${configuration.maxPerOutputW} W maximum per output).`;
    return {
      ruleId: rule.id,
      voltageV,
      loadsW,
      selectedCapacityW: configuration.totalCapacityW,
      outputCount: configuration.outputCount,
      maxPerOutputW: configuration.maxPerOutputW,
      channelsW: channels,
      unusedCapacityW: round(configuration.totalCapacityW - totalLoadW),
      fits: true,
      verified,
      explanation: verified
        ? base
        : `${base} Uses proposed library data; confirm the cited source before issuing.`,
      sources,
    };
  }

  const largest = configurations.at(-1);
  const largestOutput = largest?.maxPerOutputW ?? 0;
  const overOutput = loadsW.find((load) => load > largestOutput + 1e-9);
  const reason = overOutput
    ? `At least one load is ${overOutput} W, above the largest published per-output limit of ${largestOutput} W in this rule.`
    : `No published configuration in this rule can pack ${round(totalLoadW)} W across its available outputs.`;

  return {
    ruleId: rule.id,
    voltageV,
    loadsW,
    selectedCapacityW: null,
    outputCount: null,
    maxPerOutputW: null,
    channelsW: null,
    unusedCapacityW: null,
    fits: false,
    verified,
    explanation: verified
      ? reason
      : `${reason} Uses proposed library data; confirm the cited source before issuing.`,
    sources,
  };
}
