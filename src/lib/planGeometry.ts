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
