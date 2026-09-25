import { describe, expect, it } from "vitest";
import { dxfSheet, panForZoom, pdfSheet, snapAngle } from "./planGeometry";

describe("sheet geometry", () => {
  it("round-trips DXF coordinates through the flipped stage", () => {
    const sheet = dxfSheet({ minX: 100, minY: 50, maxX: 500, maxY: 350, width: 400, height: 300 });
    const stage = sheet.toStage({ x: 150, y: 300 });
    expect(stage).toEqual({ x: 50, y: 50 });
    expect(sheet.fromStage(stage)).toEqual({ x: 150, y: 300 });
    expect(sheet.extent).toBe(400);
  });

  it("stores PDF points independent of the render scale", () => {
    const sheet = pdfSheet(900, 600);
    expect(sheet.fromStage({ x: 150, y: 300 })).toEqual({ x: 100, y: 200 });
    expect(sheet.toStage({ x: 100, y: 200 })).toEqual({ x: 150, y: 300 });
  });
});

describe("snapAngle", () => {
  it("snaps to horizontal, vertical and 45°", () => {
    expect(snapAngle({ x: 0, y: 0 }, { x: 10, y: 1 })).toMatchObject({ x: expect.closeTo(10.05, 1), y: expect.closeTo(0, 5) });
    const vertical = snapAngle({ x: 0, y: 0 }, { x: 1, y: -10 });
    expect(vertical.x).toBeCloseTo(0, 5);
    expect(vertical.y).toBeLessThan(0);
    const diagonal = snapAngle({ x: 0, y: 0 }, { x: 10, y: 9 });
    expect(diagonal.x).toBeCloseTo(diagonal.y, 5);
  });
});

describe("panForZoom", () => {
  it("keeps the point under the cursor fixed", () => {
    const pan = { x: 20, y: 30 };
    const cursor = { x: 220, y: 130 };
    const zoom = 1;
    const next = panForZoom(pan, zoom, 2, cursor);
    // Stage point under the cursor before and after.
    const before = { x: (cursor.x - pan.x) / zoom, y: (cursor.y - pan.y) / zoom };
    const after = { x: (cursor.x - next.x) / 2, y: (cursor.y - next.y) / 2 };
    expect(after).toEqual(before);
  });
});
