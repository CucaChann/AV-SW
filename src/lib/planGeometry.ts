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
  // Both targets on (nearly) one spot would shrink the sheet to a point.
  if (qx * qx + qy * qy <= length * 1e-12) return null;
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

/**
 * Like similarityFromPairs but without scaling: the turn comes from the two
 * pairs' directions and the move lines up their midpoints, so click error is
 * shared between the pairs instead of becoming a scale change.
 */
export function rigidFromPairs(pairs: PointPair[]): Similarity | null {
  if (pairs.length < 2) return similarityFromPairs(pairs);
  const [first, second] = pairs;
  const fromLength = Math.hypot(second.from.x - first.from.x, second.from.y - first.from.y);
  const toLength = Math.hypot(second.to.x - first.to.x, second.to.y - first.to.y);
  // Coincident points give no direction to turn by.
  if (fromLength < 1e-9 || toLength <= fromLength * 1e-6) return null;
  const fromAngle = Math.atan2(second.from.y - first.from.y, second.from.x - first.from.x);
  const toAngle = Math.atan2(second.to.y - first.to.y, second.to.x - first.to.x);
  const a = Math.cos(toAngle - fromAngle);
  const b = Math.sin(toAngle - fromAngle);
  const from = { x: (first.from.x + second.from.x) / 2, y: (first.from.y + second.from.y) / 2 };
  const to = { x: (first.to.x + second.to.x) / 2, y: (first.to.y + second.to.y) / 2 };
  return { a, b, tx: to.x - (a * from.x - b * from.y), ty: to.y - (b * from.x + a * from.y) };
}

/**
 * Scale changes an alignment may make. Revisions are re-exported or re-cropped,
 * not redrawn at a tenth of the size; anything outside this is a mis-click.
 */
export const ALIGN_SCALE_LIMITS = { min: 0.1, max: 10 };

/** True when a transform is finite and its scale is within ALIGN_SCALE_LIMITS. */
export function usableAlignment(t: Similarity | null): t is Similarity {
  if (!t || ![t.a, t.b, t.tx, t.ty].every(Number.isFinite)) return false;
  const scale = similarityScale(t);
  return scale >= ALIGN_SCALE_LIMITS.min && scale <= ALIGN_SCALE_LIMITS.max;
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

/** Zoom and pan that fit a stage-space rectangle into a viewport, with padding. */
export function fitRect(
  rect: { minX: number; minY: number; maxX: number; maxY: number },
  viewport: { width: number; height: number },
  padding = 48,
  limits = { min: 0, max: 4 },
) {
  const width = Math.max(rect.maxX - rect.minX, 1e-9);
  const height = Math.max(rect.maxY - rect.minY, 1e-9);
  const fitting = Math.min(
    Math.max(viewport.width - padding, 1) / width,
    Math.max(viewport.height - padding, 1) / height,
  );
  // Clamp before panning so the rectangle stays centred at the clamped zoom.
  const zoom = Math.max(limits.min, Math.min(limits.max, fitting));
  return {
    zoom,
    pan: {
      x: (viewport.width - width * zoom) / 2 - rect.minX * zoom,
      y: (viewport.height - height * zoom) / 2 - rect.minY * zoom,
    },
  };
}
