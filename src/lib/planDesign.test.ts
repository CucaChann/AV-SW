import { describe, expect, it } from "vitest";
import {
  ARCHITECTURAL_SCALES,
  defaultDesign,
  dxfUnitsPerFoot,
  formatFeet,
  moveDesignToDrawing,
  nearestRoom,
  nextTag,
  normalizeDesign,
  parseFeet,
  removeDrawingFromDesign,
  runLengthFt,
  type PlacedDevice,
  type PlacedRun,
} from "./planDesign";
import { LAYER_DEFINITIONS } from "./deviceCatalog";

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
