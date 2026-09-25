/**
 * Controlled vocabulary for product/family specs.
 *
 * Every spec stored in the library must use a key from this registry, with the
 * registry's value type and unit. Rules read specs by these keys, so adding an
 * ad-hoc key (or a value in the wrong unit) would silently break them; the
 * validator rejects both. To add a key, add it here in the same PR as the data.
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
