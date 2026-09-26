import { describe, expect, it } from "vitest";
import { assessQtlRun, type QtlRunAssessmentInput } from "./qtlRunAssessment";

const base: QtlRunAssessmentInput = {
  productId: "vers-flush-02",
  fixtureQty: 1,
  lengthFt: 5,
  wattsPerFt: 9,
  voltage: 24,
  environment: "Dry",
  dimming: "0-10V",
  powerSupplyFamilyId: "qz",
  reservePct: 0,
};

describe("assessQtlRun", () => {
  it("uses the sourced VERS length rule without inventing an ordering increment", () => {
    const result = assessQtlRun({ ...base, lengthFt: 20 });

    expect(result.ordering.covered).toBe(true);
    expect(result.ordering.minLengthIn).toBe(12);
    expect(result.ordering.maxLengthIn).toBe(98);
    expect(result.ordering.result?.minimumPieces).toBe(3);
    expect(result.ordering.result?.orderable).toBeNull();
    expect(result.ordering.note).toContain("will not invent segment lengths");
  });

  it("shows the sourced KURV range but refuses to guess the light-engine increment", () => {
    const result = assessQtlRun({ ...base, productId: "qcap-kurv" });

    expect(result.ordering.covered).toBe(true);
    expect(result.ordering.minLengthIn).toBe(12);
    expect(result.ordering.maxLengthIn).toBe(191);
    expect(result.ordering.result).toBeNull();
    expect(result.ordering.note).toContain("does not store an explicit light engine");
  });

  it("selects sourced QZ-PRO grouping for an entered 0-10V run", () => {
    const result = assessQtlRun({
      ...base,
      fixtureQty: 2,
      lengthFt: 10,
      wattsPerFt: 7,
    });

    expect(result.power.covered).toBe(true);
    expect(result.power.familyName).toBe("QZ-PRO-PH/0-10V");
    expect(result.power.result?.selectedCapacityW).toBe(192);
    expect(result.power.result?.outputCount).toBe(2);
    expect(result.power.result?.fits).toBe(true);
  });

  it("uses QZ-ND for explicit non-dimming control", () => {
    const result = assessQtlRun({ ...base, dimming: "Non-dimming", wattsPerFt: 4 });

    expect(result.power.familyName).toBe("QZ-ND");
    expect(result.power.result?.selectedCapacityW).toBe(30);
  });

  it("keeps the exact QZ control mode unresolved for the preset's mixed control text", () => {
    const result = assessQtlRun({
      ...base,
      dimming: "0-10V / Phase capable QZ variant",
    });

    expect(result.power.familyName).toBe("QZ-PRO-PH/0-10V");
    expect(result.power.result?.selectedCapacityW).toBe(96);
    expect(result.power.controlModeConfirmed).toBe(false);
    expect(result.power.unresolvedControlMethods).toEqual(["0-10v", "phase"]);
    expect(result.power.note).toContain("exact control mode still needs selection/review");
  });

  it("does not pretend an unsupported QZ control variant is source-backed", () => {
    const result = assessQtlRun({ ...base, dimming: "DMX" });

    expect(result.power.covered).toBe(true);
    expect(result.power.result).toBeNull();
    expect(result.power.note).toContain("does not identify a sourced QZ-PRO or QZ-ND variant");
  });

  it("honors the designer reserve while keeping it separate from manufacturer facts", () => {
    const result = assessQtlRun({
      ...base,
      fixtureQty: 2,
      lengthFt: 10,
      wattsPerFt: 8,
      reservePct: 10,
    });

    expect(result.power.result?.selectedCapacityW).toBe(192);
    expect(result.power.note).toContain("designer-set 10% reserve");
    expect(result.power.note).toContain("not a QTL manufacturer requirement");
  });

  it("surfaces sourced 24V voltage-drop guidance without claiming a wire-length pass", () => {
    const result = assessQtlRun({ ...base, lengthFt: 10, wattsPerFt: 6 });

    expect(result.voltageDrop.covered).toBe(true);
    expect(result.voltageDrop.result?.maxDropV).toBe(0.72);
    expect(result.voltageDrop.result?.withinTarget).toBeNull();
    expect(result.voltageDrop.note).toContain("cannot pass/fail the run");
  });

  it("does not apply the 24V voltage-drop rule to a 48V run", () => {
    const result = assessQtlRun({ ...base, voltage: 48 });

    expect(result.voltageDrop.covered).toBe(true);
    expect(result.voltageDrop.result).toBeNull();
    expect(result.voltageDrop.note).toContain("24 V systems");
  });

  it("returns source links for the facts and rules it used", () => {
    const result = assessQtlRun(base);
    const ids = result.sources.map((source) => source.id);

    expect(ids).toContain("qtl-vers-flush-02-web");
    expect(ids).toContain("qtl-qz-pro-spec");
    expect(ids).toContain("qtl-qz-pro-ordering");
    expect(ids).toContain("qtl-voltage-drop-blog");
  });
});
