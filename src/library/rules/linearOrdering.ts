import { isVerified } from "../query";
import type { LinearOrderingRule, SourceRef } from "../schema";

export type LinearOrderingResult = {
  ruleId: string;
  variant: string;
  requestedTotalIn: number;
  orderingMode: "exact" | "optimal" | null;
  minLengthIn: number | null;
  maxLengthIn: number | null;
  lengthIncrementIn: number | null;
  /** null means the source gives limits but not enough information to prove exact orderability. */
  orderable: boolean | null;
  /** Exact orderable fixture pieces, when AV-SW can derive them without guessing. */
  segmentsIn: number[] | null;
  minimumPieces: number | null;
  nearestLowerTotalIn: number | null;
  nearestUpperTotalIn: number | null;
  verified: boolean;
  explanation: string;
  sources: SourceRef[];
};

const SCALE = 1000;
const toUnits = (inches: number) => Math.round(inches * SCALE);
const fromUnits = (units: number) => units / SCALE;

function variantFor(rule: LinearOrderingRule, variant: string) {
  return rule.params.variants.find((candidate) => candidate.variant === variant) ?? null;
}

function segmentExact(
  total: number,
  minimum: number,
  maximum: number,
  increment: number,
): number[] | null {
  if (total <= 0 || minimum <= 0 || maximum < minimum || increment <= 0) return null;

  const minimumPieces = Math.max(1, Math.ceil(total / maximum));
  const maximumPieces = Math.floor(total / minimum);

  for (let pieces = minimumPieces; pieces <= maximumPieces; pieces += 1) {
    const extra = total - pieces * minimum;
    if (extra < 0 || extra % increment !== 0) continue;

    const steps = extra / increment;
    const maxStepsPerPiece = Math.floor((maximum - minimum) / increment);
    if (steps > pieces * maxStepsPerPiece) continue;

    const baseSteps = Math.floor(steps / pieces);
    const remainder = steps % pieces;
    const segments = Array.from({ length: pieces }, (_, index) => {
      const pieceSteps = baseSteps + (index < remainder ? 1 : 0);
      return minimum + pieceSteps * increment;
    });

    if (segments.every((piece) => piece >= minimum && piece <= maximum)) {
      return segments;
    }
  }

  return null;
}

function nearestOrderableTotals(
  total: number,
  minimum: number,
  maximum: number,
  increment: number,
) {
  const maximumPieces = Math.max(1, Math.floor((total + maximum * 2) / minimum));
  let lower: number | null = null;
  let upper: number | null = null;

  for (let pieces = 1; pieces <= maximumPieces; pieces += 1) {
    const minTotal = pieces * minimum;
    const maxStepsPerPiece = Math.floor((maximum - minimum) / increment);
    const maxTotal = minTotal + pieces * maxStepsPerPiece * increment;
    if (maxTotal < 0) continue;

    const relative = total - minTotal;
    const lowerSteps = Math.floor(relative / increment);
    const upperSteps = Math.ceil(relative / increment);

    for (const steps of [lowerSteps, upperSteps]) {
      if (steps < 0 || steps > pieces * maxStepsPerPiece) continue;
      const candidate = minTotal + steps * increment;
      if (candidate <= total && (lower === null || candidate > lower)) lower = candidate;
      if (candidate >= total && (upper === null || candidate < upper)) upper = candidate;
    }
  }

  return { lower, upper };
}

/**
 * Applies only manufacturer-published length constraints. When the source does
 * not publish an ordering increment, AV-SW reports the min/max check but does
 * not manufacture an "orderable" answer from assumptions.
 */
export function evaluateLinearOrdering(input: {
  rule: LinearOrderingRule;
  requestedTotalIn: number;
  variant: string;
  orderingMode?: "exact" | "optimal";
}): LinearOrderingResult {
  const { rule, variant, requestedTotalIn } = input;
  if (!Number.isFinite(requestedTotalIn) || requestedTotalIn <= 0) {
    throw new RangeError(`requestedTotalIn must be greater than zero, got ${requestedTotalIn}`);
  }

  const selected = variantFor(rule, variant);
  const sources = [rule.source];
  const verified = isVerified(rule);

  if (!selected) {
    return {
      ruleId: rule.id,
      variant,
      requestedTotalIn,
      orderingMode: null,
      minLengthIn: null,
      maxLengthIn: null,
      lengthIncrementIn: null,
      orderable: null,
      segmentsIn: null,
      minimumPieces: null,
      nearestLowerTotalIn: null,
      nearestUpperTotalIn: null,
      verified,
      explanation: `No published ordering rule for variant "${variant}" is in the library; AV-SW cannot check it.`,
      sources,
    };
  }

  const orderingMode =
    input.orderingMode ??
    (selected.lengthModes?.includes("exact") ? "exact" : selected.lengthModes?.[0] ?? null);

  if (
    input.orderingMode &&
    selected.lengthModes &&
    !selected.lengthModes.includes(input.orderingMode)
  ) {
    return {
      ruleId: rule.id,
      variant,
      requestedTotalIn,
      orderingMode: input.orderingMode,
      minLengthIn: selected.minLengthIn,
      maxLengthIn: selected.maxLengthIn,
      lengthIncrementIn: selected.lengthIncrementIn ?? null,
      orderable: null,
      segmentsIn: null,
      minimumPieces: null,
      nearestLowerTotalIn: null,
      nearestUpperTotalIn: null,
      verified,
      explanation: `Ordering mode "${input.orderingMode}" is not published for variant "${variant}" in this rule; AV-SW cannot check it.`,
      sources,
    };
  }

  if (orderingMode === "optimal" && selected.optimalRequiresChart) {
    const explanation =
      "QTL publishes Optimal as a distinct ordering mode whose finished length is rounded using its Exact/Optimal fixture-length charts. Those chart values are not encoded in the library, so AV-SW will not calculate an Optimal length yet.";
    return {
      ruleId: rule.id,
      variant,
      requestedTotalIn,
      orderingMode,
      minLengthIn: selected.minLengthIn,
      maxLengthIn: selected.maxLengthIn,
      lengthIncrementIn: selected.lengthIncrementIn ?? null,
      orderable: null,
      segmentsIn: null,
      minimumPieces: Math.max(1, Math.ceil(requestedTotalIn / selected.maxLengthIn)),
      nearestLowerTotalIn: null,
      nearestUpperTotalIn: null,
      verified,
      explanation: verified
        ? explanation
        : `${explanation} Uses proposed library data; confirm the cited source before issuing.`,
      sources,
    };
  }

  const minimum = toUnits(selected.minLengthIn);
  const maximum = toUnits(selected.maxLengthIn);
  const total = toUnits(requestedTotalIn);
  const minimumPieces = Math.max(1, Math.ceil(total / maximum));

  if (selected.lengthIncrementIn === undefined) {
    const withinSingleFixtureLimits = total >= minimum && total <= maximum;
    const explanation = withinSingleFixtureLimits
      ? `The requested length is within the published ${selected.minLengthIn}–${selected.maxLengthIn} in limits, but the source does not publish a universal ordering increment; exact orderability is unknown.`
      : `The request needs at least ${minimumPieces} fixture pieces to stay under the published ${selected.maxLengthIn} in maximum, but the source does not publish a universal ordering increment; AV-SW will not invent segment lengths.`;
    return {
      ruleId: rule.id,
      variant,
      requestedTotalIn,
      orderingMode,
      minLengthIn: selected.minLengthIn,
      maxLengthIn: selected.maxLengthIn,
      lengthIncrementIn: null,
      orderable: null,
      segmentsIn: null,
      minimumPieces,
      nearestLowerTotalIn: null,
      nearestUpperTotalIn: null,
      verified,
      explanation: verified ? explanation : `${explanation} Uses proposed library data; confirm the cited source before issuing.`,
      sources,
    };
  }

  const increment = toUnits(selected.lengthIncrementIn);
  const segments = segmentExact(total, minimum, maximum, increment);
  const nearest = nearestOrderableTotals(total, minimum, maximum, increment);
  const orderable = segments !== null;

  const baseExplanation = orderable
    ? `${requestedTotalIn} in can be ordered as ${segments.map((piece) => `${fromUnits(piece)} in`).join(" + ")} using the published ${selected.lengthIncrementIn} in increment; total length is preserved exactly.`
    : `${requestedTotalIn} in cannot be represented exactly using the published ${selected.lengthIncrementIn} in increment while keeping every piece between ${selected.minLengthIn} and ${selected.maxLengthIn} in.`;

  return {
    ruleId: rule.id,
    variant,
    requestedTotalIn,
    orderingMode,
    minLengthIn: selected.minLengthIn,
    maxLengthIn: selected.maxLengthIn,
    lengthIncrementIn: selected.lengthIncrementIn,
    orderable,
    segmentsIn: segments?.map(fromUnits) ?? null,
    minimumPieces,
    nearestLowerTotalIn: nearest.lower === null ? null : fromUnits(nearest.lower),
    nearestUpperTotalIn: nearest.upper === null ? null : fromUnits(nearest.upper),
    verified,
    explanation: verified
      ? baseExplanation
      : `${baseExplanation} Uses proposed library data; confirm the cited source before issuing.`,
    sources,
  };
}
