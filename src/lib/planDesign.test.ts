import { describe, expect, it } from "vitest";
import {
  alignSheet,
  ARCHITECTURAL_SCALES,
  carryDesignToRevision,
  defaultDesign,
  dxfUnitsPerFoot,
  formatFeet,
  itemCenter,
  moveDesignToDrawing,
  nearestRoom,
  nextTag,
  normalizeDesign,
  parseFeet,
  markSheetVerified,
  removeDrawingFromDesign,
  resolveDxfRevision,
  runLengthFt,
  unverifiedSheet,
  type PlacedDevice,
  type PlacedRun,
} from "./planDesign";
import { LAYER_DEFINITIONS } from "./deviceCatalog";
import { similarityFromPairs } from "./planGeometry";

const base = {
  drawingId: "d1",
  page: 1,
  room: "",
  brand: "",
  model: "",
  notes: "",
  cableType: "CAT6A",
  quantity: 1,
};

const keypad = (id: string, tag: string, x = 10, y = 10): PlacedDevice => ({
  ...base,
  id,
  typeId: "keypad",
  tag,
  kind: "device",
  at: { x, y },
  rotation: 0,
});

const cable = (points: Array<[number, number]>): PlacedRun => ({
  ...base,
  id: "r1",
  typeId: "cable-run",
  tag: "CBL-1",
  kind: "run",
  points: points.map(([x, y]) => ({ x, y })),
});

describe("design defaults", () => {
  it("has every layer, visible and unlocked", () => {
    const design = defaultDesign();
    expect(design.layers.map((layer) => layer.key)).toEqual(LAYER_DEFINITIONS.map((layer) => layer.key));
    expect(design.layers.every((layer) => layer.visible && !layer.locked)).toBe(true);
  });
});

describe("nextTag", () => {
  it("continues after the highest tag of the same type", () => {
    const items = [keypad("a", "KP-1"), keypad("b", "KP-4"), keypad("c", "custom")];
    expect(nextTag(items, "keypad")).toBe("KP-5");
    expect(nextTag(items, "downlight")).toBe("DL-1");
  });
});

describe("lengths and scale", () => {
  it("measures a run in feet once the sheet has a scale", () => {
    const run = cable([[0, 0], [120, 0], [120, 60]]); // 180 drawing units
    expect(runLengthFt(run, { drawingId: "d1", page: 1, unitsPerFoot: 12, label: "Inches" })).toBe(15);
    expect(runLengthFt(run, undefined)).toBeNull();
  });

  it("knows DXF units and architectural PDF scales", () => {
    expect(dxfUnitsPerFoot("Inches")).toBe(12);
    expect(dxfUnitsPerFoot("Millimeters")).toBe(304.8);
    expect(dxfUnitsPerFoot("Unitless")).toBeNull();
    expect(ARCHITECTURAL_SCALES.find((scale) => scale.label.startsWith("1/4"))?.unitsPerFoot).toBe(18);
  });

  it("formats and parses feet and inches", () => {
    expect(formatFeet(12.5)).toBe("12'-6\"");
    expect(formatFeet(11.999)).toBe("12'-0\"");
    for (const [input, feet] of [
      ["12'-6\"", 12.5],
      ["12' 6", 12.5],
      ["12'6", 12.5],
      ["12.5", 12.5],
      ["12.5'", 12.5],
      ["150\"", 12.5],
      ["18'-3\"", 18.25],
    ] as const) {
      expect(parseFeet(input), input).toBeCloseTo(feet);
    }
    expect(parseFeet("")).toBeNull();
    expect(parseFeet("abc")).toBeNull();
    expect(parseFeet("0")).toBeNull();
  });
});

describe("nearestRoom", () => {
  const rooms = [
    { label: "KITCHEN", normalizedType: "Kitchen", position: { x: 100, y: 100 }, layer: "A" },
    { label: "OFFICE", normalizedType: "Office", position: { x: 400, y: 100 }, layer: "A" },
  ];

  it("picks the closest label", () => {
    expect(nearestRoom({ x: 350, y: 120 }, rooms, 1000)).toBe("OFFICE");
  });

  it("leaves far-away devices unassigned", () => {
    expect(nearestRoom({ x: 900, y: 900 }, rooms, 1000)).toBe("");
  });
});

describe("normalizeDesign", () => {
  it("reports layer and scale lists that are not lists", () => {
    const repairs: string[] = [];
    const design = normalizeDesign({ layers: "junk", items: [], scales: { page: 1 } }, repairs);
    expect(repairs).toEqual(["design.layers", "design.scales"]);
    expect(design.layers).toHaveLength(LAYER_DEFINITIONS.length);
    expect(design.scales).toEqual([]);
  });

  it("round-trips a valid design", () => {
    const design = { ...defaultDesign(), items: [keypad("a", "KP-1"), cable([[0, 0], [10, 0]])] };
    const repairs: string[] = [];
    expect(normalizeDesign(JSON.parse(JSON.stringify(design)), repairs)).toEqual(design);
    expect(repairs).toEqual([]);
  });

  it("drops unknown types and broken geometry, and reports them", () => {
    const repairs: string[] = [];
    const design = normalizeDesign(
      {
        layers: [{ key: "audio", visible: false, locked: "yes" }],
        items: [
          keypad("a", "KP-1"),
          { ...keypad("b", "KP-2"), typeId: "flux-capacitor" },
          { ...keypad("c", "KP-3"), at: { x: "left", y: 2 } },
          { ...cable([[0, 0]]), id: "r2" },
          { ...keypad("d", "KP-4"), room: 7 },
        ],
        scales: [
          { drawingId: "d1", page: 1, unitsPerFoot: 12, label: "Inches" },
          { drawingId: "d1", page: 0, unitsPerFoot: -1 },
        ],
      },
      repairs,
    );
    expect(design.items.map((item) => item.tag)).toEqual(["KP-1", "KP-4"]);
    expect(design.items[1].room).toBe("");
    expect(design.layers.find((layer) => layer.key === "audio")).toEqual({ key: "audio", visible: false, locked: false });
    expect(design.scales).toHaveLength(1);
    expect(repairs).toEqual([
      "design.layers.audio.locked",
      "design.items[1]",
      "design.items[2]",
      "design.items[3]",
      "design.items[4].room",
      "design.scales[1]",
    ]);
  });

  it("uses defaults for projects saved before the editor existed", () => {
    expect(normalizeDesign(undefined)).toEqual(defaultDesign());
  });
});

describe("replacing a drawing", () => {
  const design = {
    ...defaultDesign(),
    items: [keypad("a", "KP-1"), { ...keypad("b", "KP-2"), drawingId: "other" }],
    scales: [{ drawingId: "d1", page: 1, unitsPerFoot: 18, label: "1/4" }],
  };

  it("moves items and scales onto the new drawing", () => {
    const moved = moveDesignToDrawing(design, "d1", "d2");
    expect(moved.items.map((item) => item.drawingId)).toEqual(["d2", "other"]);
    expect(moved.scales[0].drawingId).toBe("d2");
  });

  it("or removes them", () => {
    const removed = removeDrawingFromDesign(design, "d1");
    expect(removed.items.map((item) => item.id)).toEqual(["b"]);
    expect(removed.scales).toEqual([]);
  });
});

describe("itemCenter", () => {
  it("is a device's position or the middle of a run's extent", () => {
    const base = { id: "a", typeId: "keypad", drawingId: "d1", page: 1, tag: "", room: "", brand: "", model: "", notes: "", cableType: "CAT6A", quantity: 1 };
    const device: PlacedDevice = { ...base, kind: "device", at: { x: 3, y: 4 }, rotation: 0 };
    const run: PlacedRun = { ...base, kind: "run", points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 6 }] };
    expect(itemCenter(device)).toEqual({ x: 3, y: 4 });
    expect(itemCenter(run)).toEqual({ x: 5, y: 3 });
  });
});

describe("carrying a design to a revised drawing", () => {
  const signature = { units: "Inches", bounds: { minX: 0, minY: 0, maxX: 1200, maxY: 800 } };
  const design = {
    ...defaultDesign(),
    items: [keypad("a", "KP-1"), { ...keypad("b", "KP-2"), page: 3 }, { ...keypad("c", "KP-3"), drawingId: "other" }],
    scales: [{ drawingId: "d1", page: 2, unitsPerFoot: 18, label: "1/4" }],
  };

  it("marks every PDF sheet that received items or a scale", () => {
    const carried = carryDesignToRevision(design, "d1", "d2", "pdf", null);
    expect(carried.items.map((item) => item.drawingId)).toEqual(["d2", "d2", "other"]);
    expect(carried.unverifiedSheets.map((sheet) => [sheet.drawingId, sheet.page])).toEqual([
      ["d2", 1],
      ["d2", 2],
      ["d2", 3],
    ]);
    expect(carried.unverifiedSheets[0].reason).toContain("PDF");
  });

  it("clears a DXF mark when the revision keeps the same units and extents", () => {
    const carried = carryDesignToRevision({ ...design, items: [keypad("a", "KP-1")], scales: [] }, "d1", "d2", "dxf", signature);
    expect(unverifiedSheet(carried, "d2", 1)?.previous).toEqual(signature);
    const resolved = resolveDxfRevision(carried, "d2", {
      units: "Inches",
      bounds: { minX: 0, minY: 0, maxX: 1200 + 1e-7, maxY: 800 },
    });
    expect(resolved.unverifiedSheets).toEqual([]);
  });

  it("keeps a DXF mark, with the reason, when units or extents changed", () => {
    const carried = carryDesignToRevision({ ...design, items: [keypad("a", "KP-1")], scales: [] }, "d1", "d2", "dxf", signature);
    const moved = resolveDxfRevision(carried, "d2", { units: "Inches", bounds: { minX: -50, minY: 0, maxX: 1150, maxY: 800 } });
    expect(unverifiedSheet(moved, "d2", 1)).toMatchObject({ reason: expect.stringContaining("extents differ") });
    expect(unverifiedSheet(moved, "d2", 1)?.previous).toBeUndefined();
    const units = resolveDxfRevision(carried, "d2", { ...signature, units: "Millimeters" });
    expect(unverifiedSheet(units, "d2", 1)?.reason).toContain("Millimeters");
    // Only compared once: a later read doesn't clear it.
    expect(resolveDxfRevision(moved, "d2", signature)).toBe(moved);
  });

  it("stays unverified when the replaced DXF couldn't be read", () => {
    const carried = carryDesignToRevision({ ...design, items: [keypad("a", "KP-1")], scales: [] }, "d1", "d2", "dxf", null);
    expect(unverifiedSheet(carried, "d2", 1)).toMatchObject({ reason: expect.stringContaining("couldn't be compared") });
    expect(resolveDxfRevision(carried, "d2", signature)).toBe(carried);
  });

  it("drops marks with the drawing, and clears one when confirmed", () => {
    const carried = carryDesignToRevision(design, "d1", "d2", "pdf", null);
    expect(markSheetVerified(carried, "d2", 2).unverifiedSheets.map((sheet) => sheet.page)).toEqual([1, 3]);
    expect(removeDrawingFromDesign(carried, "d2").unverifiedSheets).toEqual([]);
  });

  it("round-trips through normalization and reports bad entries", () => {
    const carried = carryDesignToRevision({ ...design, items: [keypad("a", "KP-1")], scales: [] }, "d1", "d2", "dxf", signature);
    expect(normalizeDesign(JSON.parse(JSON.stringify(carried))).unverifiedSheets).toEqual(carried.unverifiedSheets);
    const repairs: string[] = [];
    const normalized = normalizeDesign(
      { unverifiedSheets: [{ drawingId: "d2", page: 0 }, { drawingId: "d2", page: 1, previous: { units: "Feet" } }] },
      repairs,
    );
    expect(repairs).toEqual(["design.unverifiedSheets[0]", "design.unverifiedSheets[1].previous"]);
    expect(normalized.unverifiedSheets).toEqual([{ drawingId: "d2", page: 1, reason: "" }]);
    const listRepairs: string[] = [];
    normalizeDesign({ unverifiedSheets: "junk" }, listRepairs);
    expect(listRepairs).toEqual(["design.unverifiedSheets"]);
  });
});

describe("alignSheet", () => {
  const run = cable([
    [0, 0],
    [10, 0],
  ]);
  const design = {
    ...defaultDesign(),
    items: [keypad("a", "KP-1", 10, 0), run, { ...keypad("b", "KP-2", 10, 0), page: 2 }],
    scales: [{ drawingId: "d1", page: 1, unitsPerFoot: 12, label: "calibrated" }],
    unverifiedSheets: [
      { drawingId: "d1", page: 1, reason: "carried" },
      { drawingId: "d1", page: 2, reason: "carried" },
    ],
  };
  // Doubles the size and turns 90° counter-clockwise about the origin.
  const transform = similarityFromPairs([
    { from: { x: 0, y: 0 }, to: { x: 0, y: 0 } },
    { from: { x: 10, y: 0 }, to: { x: 0, y: 20 } },
  ])!;

  it("moves items on the sheet only, rescales its scale and marks it verified", () => {
    const aligned = alignSheet(design, "d1", 1, transform, true);
    const [device, line, otherPage] = aligned.items;
    expect(device.kind === "device" && device.at.x).toBeCloseTo(0);
    expect(device.kind === "device" && device.at.y).toBeCloseTo(20);
    expect(line.kind === "run" && line.points[1].y).toBeCloseTo(20);
    expect(otherPage).toBe(design.items[2]);
    expect(aligned.scales[0].unitsPerFoot).toBeCloseTo(24);
    expect(aligned.unverifiedSheets.map((sheet) => sheet.page)).toEqual([2]);
  });

  it("turns devices counter-clockwise on screen in both coordinate systems", () => {
    const dxf = alignSheet(design, "d1", 1, transform, true).items[0];
    const pdf = alignSheet(design, "d1", 1, transform, false).items[0];
    expect(dxf.kind === "device" && dxf.rotation).toBeCloseTo(90);
    // In y-down PDF coordinates the same maths is a clockwise turn on screen.
    expect(pdf.kind === "device" && pdf.rotation).toBeCloseTo(-90);
  });
});
