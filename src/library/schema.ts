import { z } from "zod";
import { UNITS } from "./specs";

/**
 * AV-SW product library schema, version 1.
 *
 * Design principles (see docs/PRODUCT-LIBRARY.md):
 * - Facts, relationships and rules are separate records.
 * - Every value points at a declared source (URL/document + revision).
 * - Every record carries a review state; only a person can mark it verified.
 * - Structural checks live here; cross-record checks live in validate.ts.
 */

export const LIBRARY_SCHEMA_VERSION = 1;

/** Agent names that may propose records but never verify them. */
export const AI_AGENTS = ["claude", "chatgpt", "codex", "copilot", "gpt"] as const;

const id = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "ids must be lowercase kebab-case");
const isoDate = z.iso.date();
const text = z.string().trim().min(1);

export const SOURCE_KINDS = [
  "manufacturer-web",
  "spec-sheet",
  "install-guide",
  "compatibility-guide",
  "submittal",
  "price-list",
  "vendor-quote",
  "internal-standard",
] as const;

/** A document or page that facts are taken from. Declared once, referenced by id. */
export const sourceSchema = z.strictObject({
  id,
  kind: z.enum(SOURCE_KINDS),
  title: text,
  /** Manufacturer id, or "internal" for AV-SW design standards. */
  publisher: text,
  url: z.url().optional(),
  /** Document revision/date as printed on the source, e.g. "Rev C 2025-03". */
  documentRevision: text.optional(),
  /** When a person last read this source. Required before anything citing it is verified. */
  accessedOn: isoDate.optional(),
  notes: text.optional(),
});

/** Points a value at a source. `excerpt` must be copied verbatim, never paraphrased. */
export const sourceRefSchema = z.strictObject({
  sourceId: id,
  /** Where in the source: page, table, section, or on-page heading. */
  locator: text.optional(),
  excerpt: text.optional(),
});

const reviewBase = {
  proposedBy: text,
  proposedOn: isoDate,
  notes: text.optional(),
};

export const reviewSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("proposed"), ...reviewBase }),
  z.strictObject({
    status: z.literal("verified"),
    ...reviewBase,
    verifiedBy: text,
    verifiedOn: isoDate,
  }),
]);

export const factSchema = z.strictObject({
  value: z.union([z.number(), z.string(), z.boolean(), z.array(z.string())]),
  unit: z.enum(UNITS).optional(),
  source: sourceRefSchema,
  notes: text.optional(),
});

/** Matches library items; every field given must match. */
export const selectorSchema = z
  .strictObject({
    manufacturerId: id.optional(),
    ecosystemId: id.optional(),
    familyId: id.optional(),
    productId: id.optional(),
  })
  .refine(
    (s) => Boolean(s.manufacturerId || s.ecosystemId || s.familyId || s.productId),
    "selector must name a manufacturerId, ecosystemId, familyId or productId",
  );

export const CATEGORIES = [
  "control.processor",
  "control.keypad",
  "control.dimmer",
  "control.power-module",
  "shading.shade",
  "lighting.downlight",
  "lighting.linear",
  "lighting.fixture",
  "lighting.power-supply",
  "audio.speaker",
  "audio.amplifier",
  "network.gateway",
  "network.switch",
  "network.access-point",
  "video.display",
  "video.mount",
] as const;

const specsSchema = z.record(z.string(), factSchema);

export const manufacturerSchema = z.strictObject({
  id,
  name: text,
  brands: z.array(text).default([]),
  website: z.url().optional(),
});

export const ecosystemSchema = z.strictObject({
  id,
  manufacturerId: id,
  name: text,
  description: text.optional(),
  source: sourceRefSchema,
  review: reviewSchema,
});

export const familySchema = z.strictObject({
  id,
  manufacturerId: id,
  ecosystemIds: z.array(id).default([]),
  name: text,
  category: z.enum(CATEGORIES),
  description: text.optional(),
  /** Specs shared by every product in the family. */
  specs: specsSchema.default({}),
  source: sourceRefSchema,
  review: reviewSchema,
});

export const productSchema = z.strictObject({
  id,
  manufacturerId: id,
  familyId: id,
  /** Orderable model / part number exactly as the manufacturer prints it. */
  model: text,
  name: text,
  category: z.enum(CATEGORIES),
  lifecycle: z.enum(["current", "discontinued", "unknown"]).default("unknown"),
  specs: specsSchema.default({}),
  documents: z.array(sourceRefSchema).default([]),
  source: sourceRefSchema,
  review: reviewSchema,
});

export const requirementSchema = z.strictObject({
  id,
  subject: selectorSchema,
  kind: z.enum(["control", "power", "mounting", "accessory", "network", "wiring", "other"]),
  description: text,
  /** Any one of these satisfies the requirement. */
  satisfiedBy: z.array(selectorSchema).default([]),
  source: sourceRefSchema,
  review: reviewSchema,
});

export const compatibilitySchema = z.strictObject({
  id,
  a: selectorSchema,
  b: selectorSchema,
  relation: z.enum(["compatible", "conditional", "incompatible"]),
  conditions: z.array(text).default([]),
  /** Deterministic rules that must pass for the pairing to be valid. */
  ruleIds: z.array(id).default([]),
  source: sourceRefSchema,
  review: reviewSchema,
});

export const alternativeSchema = z.strictObject({
  id,
  original: selectorSchema,
  alternative: selectorSchema,
  kind: z.enum(["direct-replacement", "functional-equivalent", "upgrade", "value-engineering"]),
  tradeoffs: z.array(text).default([]),
  source: sourceRefSchema,
  review: reviewSchema,
});

const ruleBase = {
  id,
  title: text,
  description: text,
  severity: z.enum(["error", "warning"]),
  source: sourceRefSchema,
  review: reviewSchema,
};

/**
 * Dimmer capacity for LED loads: use the dimmer's published LED rating; if it
 * has none, derate its incandescent rating by `deratingWithoutLedRating`.
 */
export const dimmerLedCapacityRuleSchema = z.strictObject({
  ...ruleBase,
  kind: z.literal("dimmer-led-capacity"),
  /** Loads the rule applies to. */
  load: selectorSchema,
  /** Dimmers the rule applies to; omit for any dimmer. */
  control: selectorSchema.optional(),
  params: z.strictObject({
    deratingWithoutLedRating: z.number().gt(0).lte(1),
  }),
});

export const ruleSchema = z.discriminatedUnion("kind", [dimmerLedCapacityRuleSchema]);

export const libraryFileSchema = z.strictObject({
  $schema: z.string().optional(),
  schemaVersion: z.literal(LIBRARY_SCHEMA_VERSION),
  manufacturers: z.array(manufacturerSchema).default([]),
  sources: z.array(sourceSchema).default([]),
  ecosystems: z.array(ecosystemSchema).default([]),
  families: z.array(familySchema).default([]),
  products: z.array(productSchema).default([]),
  requirements: z.array(requirementSchema).default([]),
  compatibility: z.array(compatibilitySchema).default([]),
  alternatives: z.array(alternativeSchema).default([]),
  rules: z.array(ruleSchema).default([]),
});

export type Source = z.infer<typeof sourceSchema>;
export type SourceRef = z.infer<typeof sourceRefSchema>;
export type Review = z.infer<typeof reviewSchema>;
export type Fact = z.infer<typeof factSchema>;
export type Selector = z.infer<typeof selectorSchema>;
export type Manufacturer = z.infer<typeof manufacturerSchema>;
export type Ecosystem = z.infer<typeof ecosystemSchema>;
export type Family = z.infer<typeof familySchema>;
export type Product = z.infer<typeof productSchema>;
export type Requirement = z.infer<typeof requirementSchema>;
export type Compatibility = z.infer<typeof compatibilitySchema>;
export type Alternative = z.infer<typeof alternativeSchema>;
export type DimmerLedCapacityRule = z.infer<typeof dimmerLedCapacityRuleSchema>;
export type Rule = z.infer<typeof ruleSchema>;
export type LibraryFile = z.infer<typeof libraryFileSchema>;

/** All library files merged. */
export type Library = Omit<LibraryFile, "$schema" | "schemaVersion">;
