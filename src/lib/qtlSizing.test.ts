import { describe, expect, it } from "vitest";
import { QTL_CATALOG_REVIEW_NOTE, QTL_PRESETS, qtlCandidatePowerSupply } from "./qtlCatalog";
import {
  audioZoneWarnings,
  DEFAULT_TOOLS_STATE,
  generateToolBom,
  newAudioZone,
  newQtlRun,
  qtlPsuMismatches,
  qtlRunPsuCandidate,
  qtlRunWarnings,
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
    expect(qtlRunWarnings(run).some((w) => w.startsWith("No design reserve"))).toBe(true);
    expect(
      qtlRunWarnings({ ...run, reservePct: 20 }).some((w) => w.startsWith("No design reserve")),
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

describe("audio zone defaults", () => {
  it("start from a high-end signal chain, not a streaming amp", () => {
    expect(newAudioZone()).toMatchObject({ amplification: "DSP / Multi-Channel Amp", control: "Savant" });
  });
});
