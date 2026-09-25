import { isVerified } from "../query";
import type { SourceRef, VoltageDropGuidanceRule } from "../schema";

export type VoltageDropGuidanceResult = {
  ruleId: string;
  nominalVoltageV: number;
  calculationVoltageV: number;
  loadWatts: number;
  currentA: number;
  targetDropPercent: number;
  maxDropV: number;
  estimatedDropV: number | null;
  estimatedDropPercent: number | null;
  withinTarget: boolean | null;
  verified: boolean;
  explanation: string;
  sources: SourceRef[];
};

const round = (value: number) => Math.round(value * 1000) / 1000;

/**
 * Applies QTL's published voltage-drop target to a known/calculated drop.
 * Conductor resistance and maximum wire length are intentionally outside this
 * rule until their source data is represented in the library.
 */
export function evaluateVoltageDropGuidance(input: {
  rule: VoltageDropGuidanceRule;
  loadWatts: number;
  targetDropPercent?: number;
  estimatedDropV?: number;
  dimmerMode?: boolean;
}): VoltageDropGuidanceResult {
  const { rule, dimmerMode = false } = input;
  const loadWatts = input.loadWatts;
  if (!Number.isFinite(loadWatts) || loadWatts <= 0) {
    throw new RangeError(`loadWatts must be greater than zero, got ${loadWatts}`);
  }

  const targetDropPercent =
    input.targetDropPercent ?? rule.params.defaultDropPercent;
  if (!rule.params.allowedDropPercents.includes(targetDropPercent)) {
    throw new RangeError(
      `targetDropPercent must be one of ${rule.params.allowedDropPercents.join(", ")}`,
    );
  }

  if (
    input.estimatedDropV !== undefined &&
    (!Number.isFinite(input.estimatedDropV) || input.estimatedDropV < 0)
  ) {
    throw new RangeError(
      `estimatedDropV must be a non-negative finite number, got ${input.estimatedDropV}`,
    );
  }

  const nominalVoltageV = rule.params.nominalVoltageV;
  const calculationVoltageV = round(
    nominalVoltageV * (dimmerMode ? rule.params.dimmerVoltageFactor : 1),
  );
  const currentA = round(loadWatts / calculationVoltageV);
  // QTL's published guidance expresses drop as a percentage of the nominal
  // system voltage. Keep the comparison at full precision and round only the
  // values returned for display.
  const maxDropVExact = (nominalVoltageV * targetDropPercent) / 100;
  const estimatedDropVExact =
    input.estimatedDropV === undefined ? null : input.estimatedDropV;
  const maxDropV = round(maxDropVExact);
  const estimatedDropV =
    estimatedDropVExact === null ? null : round(estimatedDropVExact);
  const estimatedDropPercent =
    estimatedDropVExact === null
      ? null
      : round((estimatedDropVExact / nominalVoltageV) * 100);
  const withinTarget =
    estimatedDropVExact === null
      ? null
      : estimatedDropVExact <= maxDropVExact + Number.EPSILON;

  const modeNote = dimmerMode
    ? `The QTL calculator's dimmer factor gives a calculation voltage of ${calculationVoltageV} V.`
    : `Calculation voltage is the nominal ${nominalVoltageV} V.`;

  let explanation =
    `${loadWatts} W corresponds to approximately ${currentA} A at the calculation voltage. ` +
    `A ${targetDropPercent}% target on a ${nominalVoltageV} V system allows up to ${maxDropV} V of drop. ` +
    modeNote;

  if (estimatedDropV === null) {
    explanation +=
      " No calculated or measured voltage drop was supplied, so AV-SW cannot pass/fail the run; use QTL's voltage-drop calculator or a future sourced conductor model.";
  } else {
    explanation += withinTarget
      ? ` Entered drop ${estimatedDropV} V (${estimatedDropPercent}%) is within the target.`
      : ` Entered drop ${estimatedDropV} V (${estimatedDropPercent}%) exceeds the target.`;
  }

  const verified = isVerified(rule);
  if (!verified) {
    explanation +=
      " Uses proposed library data; confirm the cited source before issuing.";
  }

  return {
    ruleId: rule.id,
    nominalVoltageV,
    calculationVoltageV,
    loadWatts,
    currentA,
    targetDropPercent,
    maxDropV,
    estimatedDropV,
    estimatedDropPercent,
    withinTarget,
    verified,
    explanation,
    sources: [rule.source],
  };
}
