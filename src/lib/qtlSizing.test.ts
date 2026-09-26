import { describe, expect, it } from "vitest";
import { QTL_CATALOG_REVIEW_NOTE, QTL_PRESETS, qtlCandidatePowerSupply } from "./qtlCatalog";
import {
  audioZoneWarnings,
  DEFAULT_TOOLS_STATE,
  generateToolBom,
  newAudioZone,
  newQtlRun,
  qtlPsuMismatches,
  qtlLengthLimits,
  qtlRunPsuCandidate,
  qtlRunWarnings,
  qtlSplitForMax,
} from "./projectTools";

// QZ family wattages in the seeded catalog: 30, 60, 96, 192, 288.

describe("qtlCandidatePowerSupply", () => {
  it("picks the smallest capacity that fits the raw load when reserve is 0", () => {
    expect(qtlCandidatePowerSupply("qz", 96)?.wattage).toBe(96);
    expect(qtlCandidatePowerSupply("qz", 96.1)?.wattage).toBe(192);
  });

  it("keeps the requested reserve unused", () => {
    // 96 W at 20% reserve needs >= 120 W of rating.
    expect(qtlCandidatePowerSupply("qz", 96, 20)?.wattage).toBe(192);
    // 48 W at 20% reserve needs exactly 60 W; the boundary counts as a fit.
    expect(qtlCandidatePowerSupply("qz", 48, 20)?.wattage).toBe(60);
    expect(qtlCandidatePowerSupply("qz", 48.1, 20)?.wattage).toBe(96);
  });

  it("clamps reserve to 0-80%", () => {
    expect(qtlCandidatePowerSupply("qz", 30, -50)?.wattage).toBe(30);
    // 80% cap: 12 W needs 60 W, even if 95% was requested.
    expect(qtlCandidatePowerSupply("qz", 12, 95)?.wattage).toBe(60);
  });

  it("reports no match when the load exceeds the family", () => {
    const result = qtlCandidatePowerSupply("qz", 400);
    expect(result?.family.id).toBe("qz");
    expect(result?.wattage).toBeNull();
  });

  it("returns null for unknown families or no load", () => {
    expect(qtlCandidatePowerSupply("nope", 50)).toBeNull();
    expect(qtlCandidatePowerSupply("qz", 0)).toBeNull();
  });
});

describe("qtlRunPsuCandidate", () => {
  it("uses the run's connected load and reserve", () => {
    const run = {
      ...newQtlRun(),
      lengthFt: 16,
      wattsPerFt: 6,
      fixtureQty: 1,
      reservePct: 20,
    };
    // 96 W connected; 20% reserve -> needs 120 W -> QZ 192 W.
    expect(qtlRunPsuCandidate(run)?.wattage).toBe(192);
    expect(qtlRunPsuCandidate({ ...run, reservePct: 0 })?.wattage).toBe(96);
  });

  it("warns when no reserve is set", () => {
    const run = { ...newQtlRun(), room: "Kitchen", feed: "Left" as const };
    expect(qtlRunWarnings(run).some((w) => w.startsWith("No design reserve is applied"))).toBe(true);
    expect(
      qtlRunWarnings({ ...run, reservePct: 20 }).some((w) => w.startsWith("No design reserve is applied")),
    ).toBe(false);
  });
});

describe("audioZoneWarnings", () => {
  it("flags a TBD amplification strategy", () => {
    const zone = { ...newAudioZone(), room: "Den", amplification: "TBD" as const };
    expect(audioZoneWarnings(zone).some((w) => w.startsWith("Amplification is TBD"))).toBe(true);
  });

  it("does not flag powered speakers", () => {
    const zone = { ...newAudioZone(), room: "Den", amplification: "Powered Speaker" as const };
    expect(audioZoneWarnings(zone).some((w) => w.startsWith("Amplification is TBD"))).toBe(false);
  });
});

describe("qtlRunPsuCandidate family compatibility", () => {
  const indoorRun = {
    ...newQtlRun(),
    room: "Kitchen",
    lengthFt: 10,
    wattsPerFt: 4,
    reservePct: 20,
    environment: "Dry" as const,
    dimming: "0-10V",
  };

  it("sizes a compatible family", () => {
    const candidate = qtlRunPsuCandidate({ ...indoorRun, powerSupplyFamilyId: "qz" });
    expect(candidate?.mismatches).toEqual([]);
    expect(candidate?.wattage).toBe(60);
  });

  it("rejects an AC direct-burial family for a dry 24 V DC run", () => {
    const run = { ...indoorRun, powerSupplyFamilyId: "qhex" };
    const candidate = qtlRunPsuCandidate(run);
    expect(candidate?.wattage).toBeNull();
    expect(candidate?.mismatches.join(" ")).toMatch(/AC transformer family/);
    expect(candidate?.mismatches.join(" ")).toMatch(/indoor dry location/);
    expect(candidate?.mismatches.join(" ")).toMatch(/calls for 0-10V/);
    expect(qtlRunWarnings(run).some((w) => w.startsWith("PSU family mismatch"))).toBe(true);
  });

  it("rejects a family without the run's DC voltage", () => {
    const candidate = qtlRunPsuCandidate({ ...indoorRun, voltage: 48, powerSupplyFamilyId: "qz" });
    expect(candidate?.wattage).toBeNull();
    expect(candidate?.mismatches).toEqual(["QZ outputs 24VDC; this run needs 48VDC."]);
  });

  it("rejects an outdoor-only DC family for an indoor dry run", () => {
    const candidate = qtlRunPsuCandidate({ ...indoorRun, powerSupplyFamilyId: "qset-dc" });
    expect(candidate?.mismatches).toHaveLength(1);
    expect(candidate?.mismatches[0]).toMatch(/indoor dry location/);
  });

  it("rejects a family without the run's control protocol", () => {
    const candidate = qtlRunPsuCandidate({ ...indoorRun, dimming: "Phase (ELV)", powerSupplyFamilyId: "qtm" });
    expect(candidate?.mismatches).toHaveLength(1);
    expect(candidate?.mismatches[0]).toMatch(/calls for Phase/);
  });

  it("pairs every built-in preset with a compatible family", () => {
    for (const preset of QTL_PRESETS) {
      const run = {
        ...newQtlRun(),
        environment: preset.environment,
        dimming: preset.dimming,
        powerSupplyFamilyId: preset.powerSupplyFamilyId,
      };
      expect(qtlPsuMismatches(run), preset.id).toEqual([]);
    }
  });
});

describe("QTL BOM basis", () => {
  it("says the capacity data is not yet verified in the library", () => {
    const tools = {
      ...DEFAULT_TOOLS_STATE,
      qtlRuns: [{ ...newQtlRun(), room: "Kitchen", lengthFt: 10, wattsPerFt: 4, reservePct: 20 }],
    };
    const driver = generateToolBom(tools, "new-build").find((item) => item.id.endsWith("-driver"));
    expect(driver?.basis).toContain("60W");
    expect(driver?.basis).toContain(QTL_CATALOG_REVIEW_NOTE);
    expect(driver?.confidence).toBe("Review");
  });
});

describe("QTL fixture length limits", () => {
  // VERS-FLUSH (02) in the seeded catalog: 12" minimum, 98" maximum.
  const vers = { ...newQtlRun(), room: "Kitchen", productId: "vers-flush-02", maxRunFt: 0 };

  it("uses the catalog limits for a selected product", () => {
    expect(qtlLengthLimits(vers)).toMatchObject({ maxFt: 98 / 12, minFt: 1 });
    expect(qtlLengthLimits({ ...newQtlRun(), maxRunFt: 6 })).toMatchObject({ maxFt: 6, minFt: 0, source: "entered" });
    expect(qtlLengthLimits(newQtlRun()).maxFt).toBe(0);
  });

  it("splits an over-length fixture into the fewest pieces that fit", () => {
    const split = qtlSplitForMax({ ...vers, lengthFt: 20, fixtureQty: 1 });
    expect(split).toMatchObject({ pieces: 3, fixtureQty: 3 });
    expect(split!.lengthFt * 12).toBeLessThanOrEqual(98);
    // The pieces keep the whole length (not 3 × 6.66 = 19.98 ft).
    expect(split!.lengthFt * split!.fixtureQty).toBeCloseTo(20, 9);
    // Every fixture of a multi-fixture run is split.
    expect(qtlSplitForMax({ ...vers, lengthFt: 10, fixtureQty: 2 })).toEqual({ pieces: 2, fixtureQty: 4, lengthFt: 5 });
    // Exactly at the limit, or no known limit: nothing to split.
    expect(qtlSplitForMax({ ...vers, lengthFt: 98 / 12 })).toBeNull();
    expect(qtlSplitForMax({ ...newQtlRun(), lengthFt: 40 })).toBeNull();
  });

  it("does not ask to split again after a split that lands on the limit", () => {
    const run = { ...vers, lengthFt: (3 * 98) / 12, fixtureQty: 1 };
    const split = qtlSplitForMax(run)!;
    expect(split.pieces).toBe(3);
    const after = { ...run, fixtureQty: split.fixtureQty, lengthFt: split.lengthFt };
    expect(qtlSplitForMax(after)).toBeNull();
    expect(qtlRunWarnings(after).some((w) => w.includes("maximum"))).toBe(false);
  });

  it("reports an over-length fixture once, with the split", () => {
    const warnings = qtlRunWarnings({ ...vers, lengthFt: 20, maxRunFt: 98 / 12 });
    const length = warnings.filter((w) => w.includes("maximum"));
    expect(length).toHaveLength(1);
    expect(length[0]).toContain("VERS-FLUSH (02) catalog maximum of 8'-2\"");
    expect(length[0]).toContain("at least 3 fixtures of 6'-8\" each");
  });

  it("flags a fixture shorter than the catalog minimum", () => {
    expect(qtlRunWarnings({ ...vers, lengthFt: 0.5 }).some((w) => w.includes("catalog minimum of 1'-0\""))).toBe(true);
    expect(qtlRunWarnings({ ...vers, lengthFt: 4 }).some((w) => w.includes("minimum"))).toBe(false);
  });
});

describe("QTL BOM naming", () => {
  it("skips a blank application instead of leaving a dangling dash", () => {
    const run = { ...newQtlRun(), application: "", selectedFamily: "VERS-FLUSH (02)" };
    const [fixture] = generateToolBom({ ...DEFAULT_TOOLS_STATE, qtlRuns: [run] }, "new-build");
    expect(fixture.item).toBe("VERS-FLUSH (02)");
  });
});

describe("audio zone defaults", () => {
  it("start from a high-end signal chain, not a streaming amp", () => {
    expect(newAudioZone()).toMatchObject({ amplification: "DSP / Multi-Channel Amp", control: "Savant" });
  });
});
