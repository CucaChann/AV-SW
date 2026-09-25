import { loadLibrary } from "./load";
import { numberSpec, type SpecCarrier } from "./query";
import type {
  Family,
  LinearOrderingRule,
  PowerSupplyOutputGroupingRule,
  Source,
  SourceRef,
  VoltageDropGuidanceRule,
} from "./schema";
import { evaluateLinearOrdering, type LinearOrderingResult } from "./rules/linearOrdering";
import {
  evaluatePowerSupplyOutputGrouping,
  type PowerSupplyGroupingResult,
} from "./rules/powerSupplyOutputGrouping";
import {
  evaluateVoltageDropGuidance,
  type VoltageDropGuidanceResult,
} from "./rules/voltageDropGuidance";

export type QtlRunAssessmentInput = {
  productId: string;
  fixtureQty: number;
  lengthFt: number;
  wattsPerFt: number;
  voltage: number;
  environment: string;
  dimming: string;
  powerSupplyFamilyId: string;
  reservePct: number;
};

export type QtlAssessmentSource = {
  id: string;
  title: string;
  url: string | null;
  locator: string | null;
};

export type QtlOrderingAssessment = {
  covered: boolean;
  minLengthIn: number | null;
  maxLengthIn: number | null;
  result: LinearOrderingResult | null;
  note: string;
};

export type QtlPowerAssessment = {
  covered: boolean;
  familyName: string | null;
  result: PowerSupplyGroupingResult | null;
  note: string;
};

export type QtlVoltageDropAssessment = {
  covered: boolean;
  result: VoltageDropGuidanceResult | null;
  note: string;
};

export type QtlRunAssessment = {
  libraryIssues: string[];
  ordering: QtlOrderingAssessment;
  power: QtlPowerAssessment;
  voltageDrop: QtlVoltageDropAssessment;
  sources: QtlAssessmentSource[];
};

const loaded = loadLibrary();
const library = loaded.library;

function ruleById<T>(id: string, kind: string) {
  const rule = library.rules.find((candidate) => candidate.id === id && candidate.kind === kind);
  return (rule ?? null) as T | null;
}

function familyById(id: string) {
  return library.families.find((candidate) => candidate.id === id) ?? null;
}

function sourceDetails(refs: SourceRef[]) {
  const sourceById = new Map<string, Source>(library.sources.map((source) => [source.id, source]));
  const seen = new Set<string>();
  const results: QtlAssessmentSource[] = [];
  for (const ref of refs) {
    const source = sourceById.get(ref.sourceId);
    if (!source || seen.has(source.id)) continue;
    seen.add(source.id);
    results.push({
      id: source.id,
      title: source.title,
      url: source.url ?? null,
      locator: ref.locator ?? null,
    });
  }
  return results;
}

function familyLengthRange(family: Family | null) {
  if (!family) return { minLengthIn: null, maxLengthIn: null, refs: [] as SourceRef[] };
  const carrier: SpecCarrier = family;
  const minimum = numberSpec(carrier, "linear.minLengthIn");
  const maximum = numberSpec(carrier, "linear.maxLengthIn");
  return {
    minLengthIn: minimum?.value ?? null,
    maxLengthIn: maximum?.value ?? null,
    refs: [minimum?.fact.source, maximum?.fact.source].filter((ref): ref is SourceRef => Boolean(ref)),
  };
}

function assessOrdering(input: QtlRunAssessmentInput) {
  const requestedIn = input.lengthFt * 12;

  if (input.productId === "vers-flush-02") {
    const rule = ruleById<LinearOrderingRule>(
      "qtl-vers-flush-02-linear-ordering",
      "linear-ordering",
    );
    const range = familyLengthRange(familyById("qtl-vers-flush-02"));
    if (!rule || requestedIn <= 0) {
      return {
        assessment: {
          covered: Boolean(rule),
          minLengthIn: range.minLengthIn,
          maxLengthIn: range.maxLengthIn,
          result: null,
          note: requestedIn <= 0
            ? "Enter a positive fixture length before AV-SW checks the published VERS-FLUSH limits."
            : "The source-backed VERS-FLUSH ordering rule is unavailable.",
        } satisfies QtlOrderingAssessment,
        refs: range.refs,
      };
    }
    const result = evaluateLinearOrdering({
      rule,
      requestedTotalIn: requestedIn,
      variant: "default",
    });
    return {
      assessment: {
        covered: true,
        minLengthIn: result.minLengthIn,
        maxLengthIn: result.maxLengthIn,
        result,
        note: result.explanation,
      } satisfies QtlOrderingAssessment,
      refs: [...range.refs, ...result.sources],
    };
  }

  if (input.productId === "qcap-kurv") {
    const range = familyLengthRange(familyById("qtl-qcap-kurv"));
    return {
      assessment: {
        covered: true,
        minLengthIn: range.minLengthIn,
        maxLengthIn: range.maxLengthIn,
        result: null,
        note:
          "QTL publishes different KURV ordering increments by light engine. This project run does not store an explicit light engine yet, so AV-SW can show the sourced length range but will not invent an orderable split.",
      } satisfies QtlOrderingAssessment,
      refs: range.refs,
    };
  }

  return {
    assessment: {
      covered: false,
      minLengthIn: null,
      maxLengthIn: null,
      result: null,
      note:
        "This fixture has not been migrated into the source-backed QTL library yet. Catalog values remain planning-only.",
    } satisfies QtlOrderingAssessment,
    refs: [] as SourceRef[],
  };
}

type ParsedControl = {
  methods: string[];
  exactMethod: string | undefined;
  dimmerMode: boolean;
};

function parseControl(text: string): ParsedControl {
  const normalized = text.toLowerCase();
  const methods: string[] = [];
  if (/non[- ]?dimm/.test(normalized)) methods.push("non-dimming");
  if (/0\s*-\s*10\s*v/.test(normalized)) methods.push("0-10v");
  if (/reverse[- ]?phase|\belv\b/.test(normalized)) methods.push("reverse-phase");
  else if (/forward[- ]?phase/.test(normalized)) methods.push("forward-phase");
  else if (/\bphase\b|\btriac\b/.test(normalized)) methods.push("phase");
  const unique = [...new Set(methods)];
  return {
    methods: unique,
    exactMethod: unique.length === 1 ? unique[0] : undefined,
    dimmerMode: unique.some((method) => method !== "non-dimming"),
  };
}

function qzSelection(control: ParsedControl) {
  if (control.methods.length === 1 && control.methods[0] === "non-dimming") {
    return {
      familyId: "qtl-qz-nd",
      ruleId: "qtl-qz-nd-output-grouping",
      familyName: "QZ-ND",
    };
  }
  if (control.methods.some((method) => method !== "non-dimming")) {
    return {
      familyId: "qtl-qz-pro-ph-010",
      ruleId: "qtl-qz-pro-output-grouping",
      familyName: "QZ-PRO-PH/0-10V",
    };
  }
  return null;
}

function normalizedEnvironment(environment: string) {
  const value = environment.trim().toLowerCase();
  return ["dry", "damp", "wet"].includes(value) ? value : undefined;
}

function assessPower(input: QtlRunAssessmentInput) {
  if (input.powerSupplyFamilyId !== "qz") {
    return {
      assessment: {
        covered: false,
        familyName: null,
        result: null,
        note:
          "The selected PSU family has not been migrated into the source-backed QTL library yet. Capacity remains planning-only.",
      } satisfies QtlPowerAssessment,
      refs: [] as SourceRef[],
    };
  }

  const control = parseControl(input.dimming);
  const selection = qzSelection(control);
  if (!selection) {
    return {
      assessment: {
        covered: true,
        familyName: null,
        result: null,
        note:
          "QZ is selected, but the entered control text does not identify a sourced QZ-PRO or QZ-ND variant. Select/enter a specific phase, 0-10V or non-dimming control before AV-SW treats the PSU as checked.",
      } satisfies QtlPowerAssessment,
      refs: [] as SourceRef[],
    };
  }

  const family = familyById(selection.familyId);
  const rule = ruleById<PowerSupplyOutputGroupingRule>(
    selection.ruleId,
    "power-supply-output-grouping",
  );
  const refs: SourceRef[] = [];
  if (family) refs.push(family.source);
  if (rule) refs.push(rule.source);

  const quantity = input.fixtureQty;
  const eachLoadW = input.lengthFt * input.wattsPerFt;
  if (
    !family ||
    !rule ||
    !Number.isInteger(quantity) ||
    quantity <= 0 ||
    quantity > 1000 ||
    !Number.isFinite(eachLoadW) ||
    eachLoadW <= 0
  ) {
    const reason =
      !Number.isInteger(quantity) || quantity <= 0
        ? "Fixture quantity must be a positive whole number before output grouping can be checked."
        : quantity > 1000
          ? "Fixture quantity is too large for interactive output grouping; split it into design groups."
          : eachLoadW <= 0
            ? "Enter a positive fixture length and watts/ft before output grouping can be checked."
            : "The source-backed QZ family or grouping rule is unavailable.";
    return {
      assessment: {
        covered: true,
        familyName: selection.familyName,
        result: null,
        note: reason,
      } satisfies QtlPowerAssessment,
      refs,
    };
  }

  const reservePct = Math.min(80, Math.max(0, Number.isFinite(input.reservePct) ? input.reservePct : 0));
  const result = evaluatePowerSupplyOutputGrouping({
    rule,
    powerSupply: family,
    loadsW: Array.from({ length: quantity }, () => eachLoadW),
    voltageV: input.voltage,
    dimmingMethod: control.exactMethod,
    environment: normalizedEnvironment(input.environment),
    designReservePct: reservePct,
  });

  const controlNote =
    control.methods.length > 1
      ? " The entered control text names multiple modes (" + control.methods.join(", ") + "), so the exact control mode still needs selection/review."
      : "";

  return {
    assessment: {
      covered: true,
      familyName: selection.familyName,
      result,
      note: result.explanation + controlNote,
    } satisfies QtlPowerAssessment,
    refs: [...refs, ...result.sources],
  };
}

function assessVoltageDrop(input: QtlRunAssessmentInput) {
  const rule = ruleById<VoltageDropGuidanceRule>(
    "qtl-24v-voltage-drop-guidance",
    "voltage-drop-guidance",
  );
  if (!rule) {
    return {
      assessment: {
        covered: false,
        result: null,
        note: "The QTL voltage-drop guidance rule is unavailable.",
      } satisfies QtlVoltageDropAssessment,
      refs: [] as SourceRef[],
    };
  }
  if (input.voltage !== rule.params.nominalVoltageV) {
    return {
      assessment: {
        covered: true,
        result: null,
        note:
          "The encoded QTL voltage-drop guidance is for " +
          rule.params.nominalVoltageV +
          " V systems; this run is " +
          input.voltage +
          " V.",
      } satisfies QtlVoltageDropAssessment,
      refs: [rule.source],
    };
  }
  const loadWatts = input.lengthFt * input.wattsPerFt * input.fixtureQty;
  if (!Number.isFinite(loadWatts) || loadWatts <= 0) {
    return {
      assessment: {
        covered: true,
        result: null,
        note: "Enter a positive connected load before voltage-drop guidance can be calculated.",
      } satisfies QtlVoltageDropAssessment,
      refs: [rule.source],
    };
  }
  const control = parseControl(input.dimming);
  const result = evaluateVoltageDropGuidance({
    rule,
    loadWatts,
    dimmerMode: control.dimmerMode,
  });
  return {
    assessment: {
      covered: true,
      result,
      note: result.explanation,
    } satisfies QtlVoltageDropAssessment,
    refs: result.sources,
  };
}

export function assessQtlRun(input: QtlRunAssessmentInput): QtlRunAssessment {
  const ordering = assessOrdering(input);
  const power = assessPower(input);
  const voltageDrop = assessVoltageDrop(input);
  const refs = [...ordering.refs, ...power.refs, ...voltageDrop.refs];

  return {
    libraryIssues: loaded.issues.map(
      (issue) => (issue.file ?? "library") + ":" + issue.at + ": " + issue.message,
    ),
    ordering: ordering.assessment,
    power: power.assessment,
    voltageDrop: voltageDrop.assessment,
    sources: sourceDetails(refs),
  };
}
