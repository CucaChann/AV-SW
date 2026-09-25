import type { PlanPoint } from "../../lib/planDesign";
import type { PointPair } from "../../lib/planGeometry";

/** What a click on the plan does. */
export type Tool =
  | { kind: "select" }
  | { kind: "place"; typeId: string }
  | { kind: "draw"; typeId: string; points: PlanPoint[] }
  | { kind: "measure"; points: PlanPoint[] }
  | { kind: "calibrate"; points: PlanPoint[] }
  /** Re-register a carried sheet: pairs of (where it is → where it belongs). */
  | { kind: "align"; pairs: PointPair[]; from: PlanPoint | null; note?: string };

/** An alignment waiting for Apply, bound to the sheet its points were picked on. */
export type AlignReview = {
  drawingId: string;
  page: number;
  pairs: PointPair[];
  /** Fit a turn and move only. A DXF's units already fix its scale. */
  keepScale: boolean;
};

/**
 * The tool after the PDF page changes. Points picked on one page mean nothing
 * on another, so they are dropped, and an alignment in progress is cancelled
 * (applying it would move the new page's items by the old page's points).
 */
export function toolAfterPageChange(tool: Tool): Tool {
  switch (tool.kind) {
    case "draw":
    case "measure":
    case "calibrate":
      return tool.points.length ? { ...tool, points: [] } : tool;
    case "align":
      return { kind: "select" };
    default:
      return tool;
  }
}

/** True when a pending alignment was picked on the sheet now shown. */
export function reviewMatchesSheet(review: AlignReview, drawingId: string | null, page: number) {
  return review.drawingId === drawingId && review.page === page;
}
