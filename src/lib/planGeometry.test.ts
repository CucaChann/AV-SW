import { describe, expect, it } from "vitest";
import {
  applySimilarity,
  dxfSheet,
  fitRect,
  panForZoom,
  panToCenter,
  pdfSheet,
  rigidFromPairs,
  similarityAngleDeg,
  similarityFromPairs,
  similarityScale,
  snapAngle,
} from "./planGeometry";

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

describe("panToCenter", () => {
  it("puts the stage point in the middle of the viewport", () => {
    const point = { x: 400, y: 250 };
    const pan = panToCenter(point, 2, { width: 1000, height: 600 });
    expect({ x: pan.x + point.x * 2, y: pan.y + point.y * 2 }).toEqual({ x: 500, y: 300 });
  });
});

describe("similarityFromPairs", () => {
  it("moves by one pair", () => {
    const t = similarityFromPairs([{ from: { x: 1, y: 2 }, to: { x: 4, y: 6 } }])!;
    expect(applySimilarity(t, { x: 10, y: 10 })).toEqual({ x: 13, y: 14 });
    expect(similarityScale(t)).toBe(1);
  });

  it("maps both pairs exactly and reports scale and angle", () => {
    const pairs = [
      { from: { x: 100, y: 50 }, to: { x: 212.5, y: -40 } },
      { from: { x: 400, y: 50 }, to: { x: 212.5, y: 560 } },
    ];
    const t = similarityFromPairs(pairs)!;
    for (const { from, to } of pairs) {
      const mapped = applySimilarity(t, from);
      expect(mapped.x).toBeCloseTo(to.x, 9);
      expect(mapped.y).toBeCloseTo(to.y, 9);
    }
    expect(similarityScale(t)).toBeCloseTo(2);
    expect(similarityAngleDeg(t)).toBeCloseTo(90);
  });

  it("refuses two pairs that start at the same point", () => {
    expect(
      similarityFromPairs([
        { from: { x: 5, y: 5 }, to: { x: 0, y: 0 } },
        { from: { x: 5, y: 5 }, to: { x: 9, y: 9 } },
      ]),
    ).toBeNull();
  });
});

describe("fitRect", () => {
  it("centres the rectangle and keeps it inside the padded viewport", () => {
    const rect = { minX: -400, minY: 100, maxX: 600, maxY: 600 };
    const { zoom, pan } = fitRect(rect, { width: 1048, height: 800 });
    expect(zoom).toBeCloseTo(1);
    const left = rect.minX * zoom + pan.x;
    const right = rect.maxX * zoom + pan.x;
    expect(left).toBeCloseTo(24);
    expect(right).toBeCloseTo(1024);
    expect((rect.minY * zoom + pan.y + rect.maxY * zoom + pan.y) / 2).toBeCloseTo(400);
  });

  it("stays centred when the zoom is clamped", () => {
    const rect = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    const { zoom, pan } = fitRect(rect, { width: 1000, height: 800 }, 48, { min: 0.05, max: 4 });
    expect(zoom).toBe(4);
    expect(5 * zoom + pan.x).toBeCloseTo(500);
    expect(5 * zoom + pan.y).toBeCloseTo(400);
  });
});

describe("rigidFromPairs", () => {
  it("turns and moves without scaling, splitting click error between the pairs", () => {
    // The second target is 1% too far out, as a slightly-off click would be.
    const pairs = [
      { from: { x: 0, y: 0 }, to: { x: 100, y: 50 } },
      { from: { x: 100, y: 0 }, to: { x: 100, y: 151 } },
    ];
    const t = rigidFromPairs(pairs)!;
    expect(similarityScale(t)).toBeCloseTo(1, 12);
    expect(similarityAngleDeg(t)).toBeCloseTo(90);
    const first = applySimilarity(t, pairs[0].from);
    const second = applySimilarity(t, pairs[1].from);
    expect(first.y).toBeCloseTo(50.5);
    expect(second.y).toBeCloseTo(150.5);
  });

  it("is a plain move for one pair", () => {
    const t = rigidFromPairs([{ from: { x: 1, y: 1 }, to: { x: 3, y: 4 } }])!;
    expect(applySimilarity(t, { x: 0, y: 0 })).toEqual({ x: 2, y: 3 });
  });
});
