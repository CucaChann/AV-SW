import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { collectBounds, parseDxf, type DxfPrimitive } from "./dxf";

function dxf(entities: string[]) {
  return [
    "0", "SECTION", "2", "HEADER", "9", "$INSUNITS", "70", "1", "0", "ENDSEC",
    "0", "SECTION", "2", "ENTITIES",
    ...entities,
    "0", "ENDSEC", "0", "EOF",
  ].join("\n");
}

function text(label: string, x: number, y: number, layer = "A-ANNO") {
  return ["0", "TEXT", "8", layer, "10", String(x), "20", String(y), "30", "0", "40", "10", "1", label].join("\n");
}

function line(x1: number, y1: number, x2: number, y2: number, layer = "A-WALL") {
  return ["0", "LINE", "8", layer, "10", String(x1), "20", String(y1), "30", "0", "11", String(x2), "21", String(y2), "31", "0"].join("\n");
}

const roomLabels = (source: string) =>
  parseDxf(source).analysis.potentialRooms.map((room) => room.label);

describe("parseDxf room detection", () => {
  it("finds the rooms in the bundled sample", () => {
    const sample = readFileSync("samples/apartment_demo.dxf", "utf8");
    expect(roomLabels(sample)).toEqual(["LIVING ROOM", "KITCHEN", "OFFICE"]);
  });

  it("keeps separate rooms that share a label", () => {
    const source = dxf([
      line(0, 0, 1000, 600),
      text("BEDROOM", 100, 100),
      text("BEDROOM", 500, 100),
      text("BEDROOM", 900, 500),
    ]);
    expect(roomLabels(source)).toEqual(["BEDROOM", "BEDROOM", "BEDROOM"]);
  });

  it("drops a label duplicated at the same spot", () => {
    const source = dxf([
      line(0, 0, 1000, 600),
      text("KITCHEN", 300, 300),
      text("KITCHEN", 300.5, 300, "A-ANNO-DUP"),
    ]);
    expect(roomLabels(source)).toEqual(["KITCHEN"]);
  });

  it("does not read words that merely contain a room name as rooms", () => {
    const source = dxf([
      line(0, 0, 1000, 600),
      text("EMBEDDED CONDUIT", 100, 100),
      text("BATHING AREA NOTE", 400, 100),
    ]);
    expect(roomLabels(source)).toEqual([]);
  });

  it("accepts numbered room labels", () => {
    const source = dxf([
      line(0, 0, 1000, 600),
      text("BEDROOM2", 100, 100),
      text("BED 3", 400, 100),
      text("BATH2", 700, 100),
    ]);
    const types = parseDxf(source).analysis.potentialRooms.map((room) => room.normalizedType);
    expect(types).toEqual(["Bedroom", "Bedroom", "Bathroom"]);
  });
});

describe("collectBounds", () => {
  it("handles drawings with hundreds of thousands of points", () => {
    const primitives: DxfPrimitive[] = [];
    for (let i = 0; i < 150_000; i++) {
      primitives.push({ kind: "line", layer: "0", start: { x: i, y: -i }, end: { x: i + 1, y: i } });
    }
    const bounds = collectBounds(primitives);
    expect(bounds).toMatchObject({ minX: 0, maxX: 150_000, minY: -149_999, maxY: 149_999 });
  });

  it("includes circle and arc extents", () => {
    const bounds = collectBounds([
      { kind: "circle", layer: "0", center: { x: 10, y: 10 }, radius: 5 },
      { kind: "text", layer: "0", position: { x: 40, y: 0 }, text: "X" },
    ]);
    expect(bounds).toMatchObject({ minX: 5, minY: 0, maxX: 40, maxY: 15, width: 35, height: 15 });
  });
});

describe("text placement", () => {
  const texts = (source: string) =>
    parseDxf(source).primitives.filter((primitive) => primitive.kind === "text");

  it("uses the second alignment point for centered TEXT", () => {
    // Generators often write group 10 = group 11 or 0,0 for aligned text.
    const centered = ["0", "TEXT", "8", "A-ANNO", "10", "0", "20", "0", "30", "0", "11", "500", "21", "300", "31", "0",
      "40", "10", "1", "CL", "72", "1", "73", "2"].join("\n");
    const [placed] = texts(dxf([line(0, 0, 1000, 600), centered]));
    expect(placed).toMatchObject({ position: { x: 500, y: 300 }, anchor: "middle", baseline: "middle" });
  });

  it("keeps left-aligned TEXT on its insertion point", () => {
    const [placed] = texts(dxf([line(0, 0, 1000, 600), text("KITCHEN", 120, 80)]));
    expect(placed).toMatchObject({ position: { x: 120, y: 80 }, anchor: "start", baseline: "alphabetic", rotation: 0 });
  });

  it("reads MTEXT attachment points and radian rotation", () => {
    const mtext = ["0", "MTEXT", "8", "A-ANNO", "10", "200", "20", "100", "30", "0", "40", "10",
      "71", "5", "50", String(Math.PI / 2), "1", "LIVING ROOM"].join("\n");
    const [placed] = texts(dxf([line(0, 0, 1000, 600), mtext]));
    expect(placed).toMatchObject({ position: { x: 200, y: 100 }, anchor: "middle", baseline: "middle" });
    expect((placed as { rotation: number }).rotation).toBeCloseTo(90);
  });

  it("uses the aligned position for room detection", () => {
    const centered = ["0", "TEXT", "8", "A-ANNO", "10", "0", "20", "0", "30", "0", "11", "640", "21", "420", "31", "0",
      "40", "10", "1", "DINING", "72", "1"].join("\n");
    const [room] = parseDxf(dxf([line(0, 0, 1000, 600), centered])).analysis.potentialRooms;
    expect(room.position).toEqual({ x: 640, y: 420 });
  });
});
