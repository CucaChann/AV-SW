import { describe, expect, it } from "vitest";
import { designBom, effectiveScale, mergeDesignBom } from "./designBom";
import { generatePreliminaryBom } from "./design";
import { defaultDesign, type PlacedDevice, type PlacedRun, type PlanDesign } from "./planDesign";

const shared = { drawingId: "d1", page: 1, brand: "", model: "", notes: "", cableType: "CAT6A", quantity: 1 };

const device = (id: string, typeId: string, room: string, extra: Partial<PlacedDevice> = {}): PlacedDevice => ({
  ...shared,
  id,
  typeId,
  tag: id,
  room,
  kind: "device",
  at: { x: 0, y: 0 },
  rotation: 0,
  ...extra,
});

const run = (id: string, typeId: string, lengthUnits: number, extra: Partial<PlacedRun> = {}): PlacedRun => ({
  ...shared,
  id,
  typeId,
  tag: id,
  room: "",
  kind: "run",
  points: [{ x: 0, y: 0 }, { x: lengthUnits, y: 0 }],
  ...extra,
});

const inches = () => ({ drawingId: "d1", page: 1, unitsPerFoot: 12, label: "DXF inches" });

function bomFor(design: PlanDesign, scale = inches) {
  return designBom(design, () => scale());
}

describe("designBom", () => {
  it("groups placed devices by type, brand and model with their rooms", () => {
    const design = {
      ...defaultDesign(),
      items: [
        device("k1", "keypad", "KITCHEN", { brand: "Lutron", model: "Palladiom 4-button" }),
        device("k2", "keypad", "OFFICE", { brand: "Lutron", model: "Palladiom 4-button" }),
        device("k3", "keypad", "OFFICE", { brand: "Lutron" }),
      ],
    };
    const { items, supersedes } = bomFor(design);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      system: "Lutron",
      manufacturer: "Lutron",
      item: "Keypad — Palladiom 4-button",
      quantity: "2",
      confidence: "Medium",
    });
    expect(items[0].basis).toContain("KITCHEN, OFFICE");
    expect(items[1]).toMatchObject({ item: "Keypad", quantity: "1", confidence: "Review" });
    expect(items[1].basis).toContain("Model not selected yet.");
    expect(supersedes.has("Keypads / control stations")).toBe(true);
  });

  it("totals cable runs with the Cabling builder allowances", () => {
    // 50 ft and 30 ft measured; 2 cables along the second path.
    const design = {
      ...defaultDesign(),
      items: [run("c1", "cable-run", 600), run("c2", "cable-run", 360, { quantity: 2 })],
    };
    const [cable] = bomFor(design).items;
    // (50 + 10) × 1.2 = 72, and (30 + 10) × 1.2 × 2 = 96.
    expect(cable).toMatchObject({ item: "CAT6A cable", quantity: "2 runs · 80 ft measured · 168 ft with allowances" });
  });

  it("reports shade widths and asks for a scale when a sheet has none", () => {
    const design = { ...defaultDesign(), items: [run("s1", "roller-shade", 72), run("s2", "roller-shade", 54)] };
    expect(bomFor(design).items[0].quantity).toBe("2 · 10'-6\" total width");
    const unscaled = designBom(design, () => undefined).items[0];
    expect(unscaled.quantity).toBe("2 · width needs a sheet scale");
    expect(unscaled.confidence).toBe("Review");
  });

  it("replaces the matching preliminary placeholders", () => {
    const preliminary = generatePreliminaryBom(null, [], "new-build");
    const design = { ...defaultDesign(), items: [device("a1", "access-point", "OFFICE"), device("s1", "ceiling-speaker", "DEN")] };
    const merged = mergeDesignBom(preliminary, bomFor(design));
    const names = merged.map((item) => item.item);
    expect(names).not.toContain("Wi-Fi access points");
    expect(names).not.toContain("Architectural in-wall / in-ceiling / invisible speakers");
    expect(names).toContain("Wi-Fi access point");
    expect(names).toContain("Displays");
  });
});

describe("effectiveScale", () => {
  it("prefers a stored calibration, then the DXF units", () => {
    const design = defaultDesign();
    expect(effectiveScale(design, "d1", 1, "Inches")?.unitsPerFoot).toBe(12);
    expect(effectiveScale(design, "d1", 1, "Unitless")).toBeUndefined();
    const calibrated = { ...design, scales: [{ drawingId: "d1", page: 1, unitsPerFoot: 20, label: "calibrated" }] };
    expect(effectiveScale(calibrated, "d1", 1, "Inches")?.unitsPerFoot).toBe(20);
  });
});
