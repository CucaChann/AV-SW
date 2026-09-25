import { describe, expect, it } from "vitest";
import { generatePreliminaryBom } from "./design";
import type { DrawingAnalysis } from "./dxf";

function analysis(
  layers: DrawingAnalysis["layers"],
  rooms: DrawingAnalysis["potentialRooms"] = [],
): DrawingAnalysis {
  return {
    sourceType: "DXF",
    units: "Inches",
    bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100, width: 100, height: 100 },
    entityCount: layers.reduce((sum, layer) => sum + layer.entityCount, 0),
    lineCount: 0,
    polylineCount: 0,
    circleCount: 0,
    arcCount: 0,
    textCount: 0,
    dimensionCount: 0,
    insertCount: layers.reduce((sum, layer) => sum + layer.insertCount, 0),
    layerCount: layers.length,
    layers,
    potentialRooms: rooms,
    wallLikeEntities: 0,
    doorLikeEntities: 0,
    windowLikeEntities: 0,
  };
}

const bomItem = (drawing: DrawingAnalysis, name: string) =>
  generatePreliminaryBom(drawing, [], "retrofit").find((item) => item.item === name)!;

const FIXTURES = "Existing fixtures / housings to survey";

describe("retrofit counts from drawing layers", () => {
  it("counts fixture symbols (block inserts), not the lines they are drawn with", () => {
    // 12 downlight symbols, each drawn with several entities.
    const item = bomItem(analysis([{ name: "E-LITE", entityCount: 40, insertCount: 12 }]), FIXTURES);
    expect(item.quantity).toBe("12");
    expect(item.confidence).toBe("Medium");
    expect(item.basis).toMatch(/symbols/);
  });

  it("falls back to entity counts with Review confidence", () => {
    const item = bomItem(analysis([{ name: "E-LIGHTING", entityCount: 40, insertCount: 0 }]), FIXTURES);
    expect(item.quantity).toBe("40");
    expect(item.confidence).toBe("Review");
    expect(item.basis).toMatch(/entities/);
  });

  it("does not count plumbing or architectural fixture layers as lighting", () => {
    const item = bomItem(
      analysis([
        { name: "P-FIXT", entityCount: 30, insertCount: 6 },
        { name: "A-FLOR-FIXT", entityCount: 20, insertCount: 4 },
      ]),
      FIXTURES,
    );
    expect(item.quantity).toBe("TBD");
  });
});

describe("room-driven estimates", () => {
  it("uses every detected room, including repeated labels", () => {
    const bedroom = (x: number) => ({
      label: "BEDROOM",
      normalizedType: "Bedroom",
      position: { x, y: 0 },
      layer: "A-ANNO",
    });
    const bom = generatePreliminaryBom(analysis([], [bedroom(0), bedroom(50), bedroom(90)]), [], "new-build");
    expect(bom.find((item) => item.item.startsWith("Sivoia QS"))?.quantity).toBe("3+ openings to review");
    expect(bom.find((item) => item.item.startsWith("Keypads"))?.quantity).toBe("3 est.");
  });
});
