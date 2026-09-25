import {
  AI_AGENTS,
  libraryFileSchema,
  type Fact,
  type Library,
  type Review,
  type Selector,
  type SourceRef,
} from "./schema";
import { SPEC_REGISTRY, isSpecKey } from "./specs";

export type RawLibraryFile = { path: string; data: unknown };

export type LibraryIssue = {
  /** File the problem was found in; absent for cross-file problems. */
  file?: string;
  /** Record id (or JSON path for schema errors). */
  at: string;
  message: string;
};

const COLLECTIONS = [
  "manufacturers",
  "sources",
  "ecosystems",
  "families",
  "products",
  "requirements",
  "compatibility",
  "alternatives",
  "rules",
] as const satisfies ReadonlyArray<keyof Library>;

/** Source kinds that must come from a known manufacturer, with a URL. */
const MANUFACTURER_SOURCE_KINDS = new Set([
  "manufacturer-web",
  "spec-sheet",
  "install-guide",
  "compatibility-guide",
  "submittal",
]);

export function emptyLibrary(): Library {
  return {
    manufacturers: [],
    sources: [],
    ecosystems: [],
    families: [],
    products: [],
    requirements: [],
    compatibility: [],
    alternatives: [],
    rules: [],
  };
}

export function isAiAgent(name: string) {
  const words = name.toLowerCase().split(/[^a-z0-9]+/);
  return AI_AGENTS.some((agent) => words.includes(agent));
}

/** Parses every file, merges them, and checks cross-record integrity. */
export function validateLibrary(files: RawLibraryFile[]) {
  const issues: LibraryIssue[] = [];
  const library = emptyLibrary();
  const fileOf = new Map<string, string>();

  for (const file of files) {
    const parsed = libraryFileSchema.safeParse(file.data);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        issues.push({ file: file.path, at: issue.path.join("."), message: issue.message });
      }
      continue;
    }
    for (const key of COLLECTIONS) {
      for (const record of parsed.data[key]) {
        (library[key] as Array<{ id: string }>).push(record);
        if (!fileOf.has(record.id)) fileOf.set(record.id, file.path);
      }
    }
  }

  issues.push(...checkIntegrity(library, fileOf));
  return { library, issues };
}

function checkIntegrity(library: Library, fileOf: Map<string, string>) {
  const issues: LibraryIssue[] = [];
  const report = (at: string, message: string) =>
    issues.push({ file: fileOf.get(at), at, message });

  const seen = new Map<string, string>();
  for (const key of COLLECTIONS) {
    for (const record of library[key]) {
      const previous = seen.get(record.id);
      if (previous) {
        report(record.id, `duplicate id (also used in ${previous})`);
      } else {
        seen.set(record.id, key);
      }
    }
  }

  const manufacturers = new Map(library.manufacturers.map((r) => [r.id, r]));
  const sources = new Map(library.sources.map((r) => [r.id, r]));
  const ecosystems = new Map(library.ecosystems.map((r) => [r.id, r]));
  const families = new Map(library.families.map((r) => [r.id, r]));
  const products = new Map(library.products.map((r) => [r.id, r]));
  const rules = new Map(library.rules.map((r) => [r.id, r]));

  const checkManufacturer = (at: string, manufacturerId: string) => {
    if (!manufacturers.has(manufacturerId)) {
      report(at, `unknown manufacturer "${manufacturerId}"`);
    }
  };

  const checkSourceRefs = (at: string, refs: SourceRef[]) => {
    for (const ref of refs) {
      if (!sources.has(ref.sourceId)) report(at, `unknown source "${ref.sourceId}"`);
    }
  };

  const checkSelector = (at: string, label: string, selector: Selector) => {
    const { manufacturerId, ecosystemId, familyId, productId } = selector;
    if (manufacturerId) checkManufacturer(at, manufacturerId);
    if (ecosystemId && !ecosystems.has(ecosystemId)) {
      report(at, `${label}: unknown ecosystem "${ecosystemId}"`);
    }
    const family = familyId ? families.get(familyId) : undefined;
    if (familyId && !family) report(at, `${label}: unknown family "${familyId}"`);
    const product = productId ? products.get(productId) : undefined;
    if (productId && !product) report(at, `${label}: unknown product "${productId}"`);

    if (manufacturerId && family && family.manufacturerId !== manufacturerId) {
      report(at, `${label}: family "${family.id}" is not made by "${manufacturerId}"`);
    }
    if (manufacturerId && product && product.manufacturerId !== manufacturerId) {
      report(at, `${label}: product "${product.id}" is not made by "${manufacturerId}"`);
    }
    if (family && product && product.familyId !== family.id) {
      report(at, `${label}: product "${product.id}" is not in family "${family.id}"`);
    }
  };

  const checkSpecs = (at: string, specs: Record<string, Fact>) => {
    for (const [key, fact] of Object.entries(specs)) {
      if (!isSpecKey(key)) {
        report(at, `unknown spec "${key}"; add it to src/library/specs.ts first`);
        continue;
      }
      const definition = SPEC_REGISTRY[key];
      const value = fact.value;
      const typeOk =
        definition.type === "string[]"
          ? Array.isArray(value)
          : typeof value === definition.type;
      if (!typeOk) {
        report(at, `spec "${key}" must be a ${definition.type}`);
        continue;
      }
      const expectedUnit = "unit" in definition ? definition.unit : undefined;
      if (fact.unit !== expectedUnit) {
        report(
          at,
          `spec "${key}" must use unit ${expectedUnit ?? "(none)"}, got ${fact.unit ?? "(none)"}`,
        );
      }
      if ("allowed" in definition && Array.isArray(value)) {
        const allowed: readonly string[] = definition.allowed;
        for (const item of value) {
          if (!allowed.includes(item)) report(at, `spec "${key}" does not allow "${item}"`);
        }
      }
      if (typeof value === "number" && (!Number.isFinite(value) || value < 0)) {
        report(at, `spec "${key}" must be a non-negative number`);
      }
    }
  };

  const checkReview = (at: string, review: Review, refs: SourceRef[]) => {
    if (review.status !== "verified") return;
    if (isAiAgent(review.verifiedBy)) {
      report(at, `verifiedBy "${review.verifiedBy}" is an AI agent; only a person can verify`);
    }
    if (review.verifiedOn < review.proposedOn) {
      report(at, "verifiedOn is earlier than proposedOn");
    }
    for (const ref of refs) {
      const source = sources.get(ref.sourceId);
      if (source && !source.accessedOn) {
        report(at, `verified record cites source "${source.id}" with no accessedOn date`);
      }
    }
  };

  const specRefs = (specs: Record<string, Fact>) => Object.values(specs).map((f) => f.source);

  for (const source of library.sources) {
    if (MANUFACTURER_SOURCE_KINDS.has(source.kind)) {
      if (!source.url) report(source.id, `${source.kind} sources need a url`);
      checkManufacturer(source.id, source.publisher);
    }
  }

  for (const ecosystem of library.ecosystems) {
    checkManufacturer(ecosystem.id, ecosystem.manufacturerId);
    checkSourceRefs(ecosystem.id, [ecosystem.source]);
    checkReview(ecosystem.id, ecosystem.review, [ecosystem.source]);
  }

  for (const family of library.families) {
    checkManufacturer(family.id, family.manufacturerId);
    for (const ecosystemId of family.ecosystemIds) {
      if (!ecosystems.has(ecosystemId)) report(family.id, `unknown ecosystem "${ecosystemId}"`);
    }
    checkSpecs(family.id, family.specs);
    const refs = [family.source, ...specRefs(family.specs)];
    checkSourceRefs(family.id, refs);
    checkReview(family.id, family.review, refs);
  }

  for (const product of library.products) {
    checkManufacturer(product.id, product.manufacturerId);
    const family = families.get(product.familyId);
    if (!family) {
      report(product.id, `unknown family "${product.familyId}"`);
    } else if (family.manufacturerId !== product.manufacturerId) {
      report(product.id, `family "${family.id}" belongs to "${family.manufacturerId}"`);
    }
    checkSpecs(product.id, product.specs);
    const refs = [product.source, ...product.documents, ...specRefs(product.specs)];
    checkSourceRefs(product.id, refs);
    checkReview(product.id, product.review, refs);
  }

  for (const requirement of library.requirements) {
    checkSelector(requirement.id, "subject", requirement.subject);
    requirement.satisfiedBy.forEach((selector, index) =>
      checkSelector(requirement.id, `satisfiedBy[${index}]`, selector),
    );
    checkSourceRefs(requirement.id, [requirement.source]);
    checkReview(requirement.id, requirement.review, [requirement.source]);
  }

  for (const link of library.compatibility) {
    checkSelector(link.id, "a", link.a);
    checkSelector(link.id, "b", link.b);
    if (link.relation === "conditional" && !link.conditions.length && !link.ruleIds.length) {
      report(link.id, "conditional compatibility needs conditions or ruleIds");
    }
    for (const ruleId of link.ruleIds) {
      if (!rules.has(ruleId)) report(link.id, `unknown rule "${ruleId}"`);
    }
    checkSourceRefs(link.id, [link.source]);
    checkReview(link.id, link.review, [link.source]);
  }

  for (const alternative of library.alternatives) {
    checkSelector(alternative.id, "original", alternative.original);
    checkSelector(alternative.id, "alternative", alternative.alternative);
    if (JSON.stringify(alternative.original) === JSON.stringify(alternative.alternative)) {
      report(alternative.id, "an item cannot be its own alternative");
    }
    checkSourceRefs(alternative.id, [alternative.source]);
    checkReview(alternative.id, alternative.review, [alternative.source]);
  }

  for (const rule of library.rules) {
    checkSelector(rule.id, "load", rule.load);
    if ("control" in rule && rule.control) {
      checkSelector(rule.id, "control", rule.control);
    }
    checkSourceRefs(rule.id, [rule.source]);
    checkReview(rule.id, rule.review, [rule.source]);

    if (rule.kind === "linear-ordering") {
      for (const [index, variant] of rule.params.variants.entries()) {
        if (variant.maxLengthIn < variant.minLengthIn) {
          report(rule.id, `params.variants[${index}]: maxLengthIn must be >= minLengthIn`);
        }
        if (
          variant.lengthIncrementIn !== undefined &&
          variant.lengthIncrementIn > variant.maxLengthIn
        ) {
          report(rule.id, `params.variants[${index}]: lengthIncrementIn exceeds maxLengthIn`);
        }
      }
    }

    if (rule.kind === "power-supply-output-grouping") {
      for (const [index, configuration] of rule.params.configurations.entries()) {
        const aggregateOutputLimit =
          configuration.outputCount * configuration.maxPerOutputW;
        if (configuration.totalCapacityW > aggregateOutputLimit + 1e-9) {
          report(
            rule.id,
            `params.configurations[${index}]: totalCapacityW exceeds outputCount × maxPerOutputW`,
          );
        }
      }
    }

    if (rule.kind === "voltage-drop-guidance") {
      if (!rule.params.allowedDropPercents.includes(rule.params.defaultDropPercent)) {
        report(rule.id, "defaultDropPercent must be one of allowedDropPercents");
      }
    }
  }

  return issues;
}
