/**
 * Controlled vocabulary for product/family specs.
 *
 * Every spec stored in the library must use a key from this registry, with the
 * registry's value type and unit. Rules read specs by these keys, so adding an
 * ad-hoc key (or a value in the wrong unit) would silently break them; the
 * validator rejects both. To add one, add it here in the same pull request.
 */

export const UNITS = [
  "W",
  "V",
  "A",
  "lm",
  "K",
  "in",
  "mm",
  "ft",
  "lb",
  "ohm",
  "dB",
  "Hz",
] as const;

export type Unit = (typeof UNITS)[number];

export const DIMMING_METHODS = [
  "forward-phase",
  "reverse-phase",
  "0-10v",
  "dali-2",
  "dmx",
  "lutron-ecosystem",
  "non-dimming",
] as const;

export const ENVIRONMENT_RATINGS = [
  "dry",
  "damp",
  "wet",
  "submersible",
  "indoor",
  "outdoor",
  "pool-spa",
] as const;

export const LINEAR_LIGHT_ENGINES = [
  "static-white",
  "static-white-he",
  "dynamic-white-tunable",
  "warm-dim",
  "rgb",
  "rgbw",
  "rgbw-he",
  "static-color",
] as const;

export type SpecDefinition =
  | { label: string; type: "number"; unit?: Unit }
  | { label: string; type: "string" }
  | { label: string; type: "boolean" }
  | { label: string; type: "string[]"; allowed?: readonly string[] };

export const SPEC_REGISTRY = {
  "dimming.ratedLoadIncandescentW": {
    label: "Rated load, incandescent/halogen",
    type: "number",
    unit: "W",
  },
  "dimming.ratedLoadLedW": {
    label: "Rated load, LED (published)",
    type: "number",
    unit: "W",
  },
  "dimming.methods": {
    label: "Supported dimming methods",
    type: "string[]",
    allowed: DIMMING_METHODS,
  },
  "led.inputPowerW": {
    label: "Input power per unit",
    type: "number",
    unit: "W",
  },
  "led.lumens": { label: "Delivered lumens", type: "number", unit: "lm" },
  "led.cctK": { label: "Correlated color temperature", type: "number", unit: "K" },
  "led.cri": { label: "Color rendering index (Ra)", type: "number" },
  "linear.minLengthIn": {
    label: "Minimum orderable fixture length",
    type: "number",
    unit: "in",
  },
  "linear.maxLengthIn": {
    label: "Maximum orderable fixture length",
    type: "number",
    unit: "in",
  },
  "linear.bendRadiusIn": {
    label: "Minimum bend radius",
    type: "number",
    unit: "in",
  },
  "linear.lightEngines": {
    label: "Available linear-light engines",
    type: "string[]",
    allowed: LINEAR_LIGHT_ENGINES,
  },
  "environment.ratings": {
    label: "Environmental ratings",
    type: "string[]",
    allowed: ENVIRONMENT_RATINGS,
  },
  "electrical.outputVoltageV": {
    label: "Nominal output voltage",
    type: "number",
    unit: "V",
  },
  "electrical.adjustableOutputMinV": {
    label: "Minimum adjustable output voltage",
    type: "number",
    unit: "V",
  },
  "electrical.adjustableOutputMaxV": {
    label: "Maximum adjustable output voltage",
    type: "number",
    unit: "V",
  },
  "installation.minimumAdjacentSpacingIn": {
    label: "Minimum adjacent power-supply spacing",
    type: "number",
    unit: "in",
  },
  "physical.cutoutDiameterIn": {
    label: "Ceiling cutout diameter",
    type: "number",
    unit: "in",
  },
  "physical.weightLb": { label: "Weight", type: "number", unit: "lb" },
} as const satisfies Record<string, SpecDefinition>;

export type SpecKey = keyof typeof SPEC_REGISTRY;

export function isSpecKey(key: string): key is SpecKey {
  return Object.prototype.hasOwnProperty.call(SPEC_REGISTRY, key);
}
