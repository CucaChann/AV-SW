import { describe, expect, it } from "vitest";
import { reviewMatchesSheet, toolAfterPageChange, type AlignReview, type Tool } from "./editorTools";

const point = { x: 1, y: 2 };

describe("toolAfterPageChange", () => {
  it("cancels an alignment in progress", () => {
    const aligning: Tool = { kind: "align", pairs: [{ from: point, to: point }], from: point };
    expect(toolAfterPageChange(aligning)).toEqual({ kind: "select" });
  });

  it("drops points picked on the previous page but keeps the tool", () => {
    expect(toolAfterPageChange({ kind: "draw", typeId: "cable-run", points: [point] })).toEqual({
      kind: "draw",
      typeId: "cable-run",
      points: [],
    });
    expect(toolAfterPageChange({ kind: "measure", points: [point, point] })).toEqual({ kind: "measure", points: [] });
    expect(toolAfterPageChange({ kind: "calibrate", points: [point] })).toEqual({ kind: "calibrate", points: [] });
  });

  it("leaves tools without page-bound state alone", () => {
    const place: Tool = { kind: "place", typeId: "keypad" };
    expect(toolAfterPageChange(place)).toBe(place);
    const select: Tool = { kind: "select" };
    expect(toolAfterPageChange(select)).toBe(select);
  });
});

describe("reviewMatchesSheet", () => {
  const review: AlignReview = { drawingId: "d1", page: 1, pairs: [{ from: point, to: point }], keepScale: false };

  it("only matches the sheet the points were picked on", () => {
    expect(reviewMatchesSheet(review, "d1", 1)).toBe(true);
    expect(reviewMatchesSheet(review, "d1", 2)).toBe(false);
    expect(reviewMatchesSheet(review, "d2", 1)).toBe(false);
    expect(reviewMatchesSheet(review, null, 1)).toBe(false);
  });
});
