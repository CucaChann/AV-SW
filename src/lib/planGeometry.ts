import type { DxfBounds } from "./dxf";
import type { PlanPoint } from "./planDesign";

/** pdf.js renders pages at this scale; stage pixels = PDF points × scale. */
export const PDF_RENDER_SCALE = 1.5;

/**
 * Maps drawing coordinates (what the design stores) to stage coordinates (the
 * unzoomed pixels of the rendered drawing) and back.
 */
export type SheetGeometry = {
  width: number;
  height: number;
  /** Size of the drawing in drawing units, for distance thresholds. */
  extent: number;
  toStage(point: PlanPoint): PlanPoint;
  fromStage(point: PlanPoint): PlanPoint;
};

/** DXF: world units with y up; the SVG is offset by the bounds and flipped. */
export function dxfSheet(bounds: DxfBounds): SheetGeometry {
  return {
    width: bounds.width,
    height: bounds.height,
    extent: Math.max(bounds.width, bounds.height),
    toStage: (point) => ({ x: point.x - bounds.minX, y: bounds.maxY - point.y }),
    fromStage: (point) => ({ x: point.x + bounds.minX, y: bounds.maxY - point.y }),
  };
}

/** PDF: points from the page's top-left, rendered at PDF_RENDER_SCALE. */
export function pdfSheet(widthPx: number, heightPx: number): SheetGeometry {
  return {
    width: widthPx,
    height: heightPx,
    extent: Math.max(widthPx, heightPx) / PDF_RENDER_SCALE,
    toStage: (point) => ({ x: point.x * PDF_RENDER_SCALE, y: point.y * PDF_RENDER_SCALE }),
    fromStage: (point) => ({ x: point.x / PDF_RENDER_SCALE, y: point.y / PDF_RENDER_SCALE }),
  };
}

/** Constrains `to` to the nearest 45° direction from `from` (Shift while drawing). */
export function snapAngle(from: PlanPoint, to: PlanPoint): PlanPoint {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return to;
  const step = Math.PI / 4;
  const angle = Math.round(Math.atan2(dy, dx) / step) * step;
  return { x: from.x + Math.cos(angle) * length, y: from.y + Math.sin(angle) * length };
}

/** New pan so the stage point under `cursor` (container pixels) stays put while zooming. */
export function panForZoom(
  pan: PlanPoint,
  zoom: number,
  nextZoom: number,
  cursor: PlanPoint,
): PlanPoint {
  return {
    x: cursor.x - ((cursor.x - pan.x) * nextZoom) / zoom,
    y: cursor.y - ((cursor.y - pan.y) * nextZoom) / zoom,
  };
}

/** Pan that puts a stage point in the middle of a viewport at this zoom. */
export function panToCenter(point: PlanPoint, zoom: number, viewport: { width: number; height: number }): PlanPoint {
  return { x: viewport.width / 2 - point.x * zoom, y: viewport.height / 2 - point.y * zoom };
}

/**
 * A similarity transform (move, turn, uniform scale):
 * x' = a·x − b·y + tx, y' = b·x + a·y + ty.
 */
export type Similarity = { a: number; b: number; tx: number; ty: number };

export type PointPair = { from: PlanPoint; to: PlanPoint };

export const IDENTITY: Similarity = { a: 1, b: 0, tx: 0, ty: 0 };

/**
 * The transform taking each `from` to its `to`: one pair moves, two pairs
 * also turn and scale. Null when two pairs start at the same point.
 */
export function similarityFromPairs(pairs: PointPair[]): Similarity | null {
  if (pairs.length === 0) return IDENTITY;
  const [first, second] = pairs;
  if (!second) {
    return { a: 1, b: 0, tx: first.to.x - first.from.x, ty: first.to.y - first.from.y };
  }
  const px = second.from.x - first.from.x;
  const py = second.from.y - first.from.y;
  const qx = second.to.x - first.to.x;
  const qy = second.to.y - first.to.y;
  const length = px * px + py * py;
  if (length < 1e-18) return null;
  // (a + bi) = (q2 − q1) / (p2 − p1) as complex numbers.
  const a = (qx * px + qy * py) / length;
  const b = (qy * px - qx * py) / length;
  return {
    a,
    b,
    tx: first.to.x - (a * first.from.x - b * first.from.y),
    ty: first.to.y - (b * first.from.x + a * first.from.y),
  };
}

export function applySimilarity(t: Similarity, point: PlanPoint): PlanPoint {
  return { x: t.a * point.x - t.b * point.y + t.tx, y: t.b * point.x + t.a * point.y + t.ty };
}

export function similarityScale(t: Similarity) {
  return Math.hypot(t.a, t.b);
}

/** Counter-clockwise angle in the drawing's own axes, in degrees. */
export function similarityAngleDeg(t: Similarity) {
  return (Math.atan2(t.b, t.a) * 180) / Math.PI;
}
