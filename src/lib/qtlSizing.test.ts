import { describe, expect, it } from "vitest";
import { qtlCandidatePowerSupply } from "./qtlCatalog";
import {
  audioZoneWarnings,
  newAudioZone,
  newQtlRun,
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
