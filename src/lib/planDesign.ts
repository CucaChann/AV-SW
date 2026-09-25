import {
  deviceType,
  LAYER_DEFINITIONS,
  type LayerKey,
} from "./deviceCatalog";
import type { RoomCandidate } from "./dxf";
import {
  applySimilarity,
  similarityAngleDeg,
  similarityScale,
  usableAlignment,
  type Similarity,
} from "./planGeometry";
import { isRecord, withDefaults } from "./sanitize";

/**
 * Design layer data placed on a project's drawings: devices (one point) and
 * runs (polylines), per drawing and page, plus each sheet's scale.
 *
 * Coordinates are drawing coordinates so they survive zoom and re-rendering:
 * DXF world units (y up), or PDF points from the page's top-left (y down).
 */

export type PlanPoint = { x: number; y: number };

export type DesignLayer = { key: LayerKey; visible: boolean; locked: boolean };

type ItemBase = {
  id: string;
  typeId: string;
  drawingId: string;
  page: number;
  tag: string;
  room: string;
  brand: string;
  model: string;
  notes: string;
  /** Cable runs: cable type and how many cables follow this path. */
  cableType: string;
  quantity: number;
};

export type PlacedDevice = ItemBase & { kind: "device"; at: PlanPoint; rotation: number };
export type PlacedRun = ItemBase & { kind: "run"; points: PlanPoint[] };
export type PlanItem = PlacedDevice | PlacedRun;

/** Drawing units per real foot on one sheet. */
export type DrawingScale = {
  drawingId: string;
  page: number;
  unitsPerFoot: number;
  label: string;
};

/** Extents and units of a DXF, to tell whether a revision kept the same coordinates. */
export type SheetSignature = {
  units: string;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
};

/**
 * A sheet whose items were carried over from a replaced drawing and haven't
 * been checked against it yet. Verified sheets have no entry.
 */
export type UnverifiedSheet = {
  drawingId: string;
  page: number;
  reason: string;
  /** DXF only: the replaced drawing's signature, compared once the new one is read. */
  previous?: SheetSignature;
};

export type PlanDesign = {
  layers: DesignLayer[];
  items: PlanItem[];
  scales: DrawingScale[];
  unverifiedSheets: UnverifiedSheet[];
};

export function defaultDesign(): PlanDesign {
  return {
    layers: LAYER_DEFINITIONS.map((layer) => ({ key: layer.key, visible: true, locked: false })),
    items: [],
    scales: [],
    unverifiedSheets: [],
  };
}

function itemBaseDefaults(): ItemBase {
  return {
    id: "",
    typeId: "",
    drawingId: "",
    page: 1,
    tag: "",
    room: "",
    brand: "",
    model: "",
    notes: "",
    cableType: "CAT6A",
    quantity: 1,
  };
}

export function newItemId() {
  return globalThis.crypto.randomUUID();
}

function finitePoint(value: unknown): PlanPoint | null {
  if (!isRecord(value)) return null;
  const { x, y } = value;
  return typeof x === "number" && Number.isFinite(x) && typeof y === "number" && Number.isFinite(y)
    ? { x, y }
    : null;
}

/** Saved design with invalid parts reset or dropped; paths go to `repairs`. */
export function normalizeDesign(value: unknown, repairs?: string[]): PlanDesign {
  const design = defaultDesign();
  if (value === undefined) return design;
  if (!isRecord(value)) {
    repairs?.push("design");
    return design;
  }

  if (Array.isArray(value.layers)) {
    design.layers = design.layers.map((layer) => {
      const stored = (value.layers as unknown[]).find(
        (entry) => isRecord(entry) && entry.key === layer.key,
      );
      return withDefaults(stored, layer, `design.layers.${layer.key}`, repairs);
    });
  } else if (value.layers !== undefined) {
    repairs?.push("design.layers");
  }

  if (Array.isArray(value.items)) {
    value.items.forEach((entry, index) => {
      const path = `design.items[${index}]`;
      const type = isRecord(entry) && typeof entry.typeId === "string" ? deviceType(entry.typeId) : undefined;
      if (!isRecord(entry) || !type) {
        repairs?.push(path);
        return;
      }
      const base = withDefaults(entry, itemBaseDefaults(), path, repairs);
      if (!base.id) base.id = newItemId();
      if (!Number.isInteger(base.page) || base.page < 1) base.page = 1;

      if (type.shape === "point") {
        const at = finitePoint(entry.at);
        if (entry.kind !== "device" || !at) {
          repairs?.push(path);
          return;
        }
        const rotation = typeof entry.rotation === "number" && Number.isFinite(entry.rotation) ? entry.rotation : 0;
        design.items.push({ ...base, kind: "device", at, rotation });
      } else {
        const points = Array.isArray(entry.points) ? entry.points.map(finitePoint) : [];
        if (entry.kind !== "run" || points.length < 2 || points.some((point) => !point)) {
          repairs?.push(path);
          return;
        }
        design.items.push({ ...base, kind: "run", points: points as PlanPoint[] });
      }
    });
  } else if (value.items !== undefined) {
    repairs?.push("design.items");
  }

  if (Array.isArray(value.scales)) {
    value.scales.forEach((entry, index) => {
      const scale = isRecord(entry) ? entry : {};
      const valid =
        typeof scale.drawingId === "string" &&
        typeof scale.page === "number" &&
        Number.isInteger(scale.page) &&
        scale.page >= 1 &&
        typeof scale.unitsPerFoot === "number" &&
        Number.isFinite(scale.unitsPerFoot) &&
        scale.unitsPerFoot > 0;
      if (!valid) {
        repairs?.push(`design.scales[${index}]`);
        return;
      }
      design.scales.push({
        drawingId: scale.drawingId as string,
        page: scale.page as number,
        unitsPerFoot: scale.unitsPerFoot as number,
        label: typeof scale.label === "string" ? scale.label : "",
      });
    });
  } else if (value.scales !== undefined) {
    repairs?.push("design.scales");
  }

  if (Array.isArray(value.unverifiedSheets)) {
    value.unverifiedSheets.forEach((entry, index) => {
      const sheet = isRecord(entry) ? entry : {};
      const page = sheet.page;
      if (
        typeof sheet.drawingId !== "string" ||
        typeof page !== "number" ||
        !Number.isInteger(page) ||
        page < 1
      ) {
        repairs?.push(`design.unverifiedSheets[${index}]`);
        return;
      }
      const previous = sheetSignature(sheet.previous);
      if (sheet.previous !== undefined && !previous) repairs?.push(`design.unverifiedSheets[${index}].previous`);
      design.unverifiedSheets.push({
        drawingId: sheet.drawingId,
        page,
        reason: typeof sheet.reason === "string" ? sheet.reason : "",
        ...(previous ? { previous } : {}),
      });
    });
  } else if (value.unverifiedSheets !== undefined) {
    repairs?.push("design.unverifiedSheets");
  }

  return design;
}

function sheetSignature(value: unknown): SheetSignature | null {
  if (!isRecord(value) || typeof value.units !== "string" || !isRecord(value.bounds)) return null;
  const { minX, minY, maxX, maxY } = value.bounds;
  const numbers = [minX, minY, maxX, maxY];
  if (!numbers.every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  return {
    units: value.units,
    bounds: { minX: minX as number, minY: minY as number, maxX: maxX as number, maxY: maxY as number },
  };
}

export function itemsOnSheet(design: PlanDesign, drawingId: string, page: number) {
  return design.items.filter((item) => item.drawingId === drawingId && item.page === page);
}

export function scaleFor(design: PlanDesign, drawingId: string, page: number) {
  return design.scales.find((scale) => scale.drawingId === drawingId && scale.page === page);
}

export function withScale(design: PlanDesign, scale: DrawingScale): PlanDesign {
  return {
    ...design,
    scales: [
      ...design.scales.filter(
        (existing) => !(existing.drawingId === scale.drawingId && existing.page === scale.page),
      ),
      scale,
    ],
  };
}

/** Next free tag for a device type: KP-1, KP-2… (fills after the highest number used). */
export function nextTag(items: PlanItem[], typeId: string) {
  const code = deviceType(typeId)?.code ?? "X";
  const pattern = new RegExp(`^${code}-(\\d+)$`);
  const highest = items.reduce((max, item) => {
    const match = item.typeId === typeId ? pattern.exec(item.tag) : null;
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `${code}-${highest + 1}`;
}

export function distance(a: PlanPoint, b: PlanPoint) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function polylineLength(points: PlanPoint[]) {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += distance(points[index - 1], points[index]);
  }
  return total;
}

/** Real length of a run in feet, or null when the sheet has no scale yet. */
/** Where to look for an item: a device's position, or the middle of a run's extent. */
export function itemCenter(item: PlanItem): PlanPoint {
  if (item.kind === "device") return item.at;
  const xs = item.points.map((point) => point.x);
  const ys = item.points.map((point) => point.y);
  return {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: (Math.min(...ys) + Math.max(...ys)) / 2,
  };
}

export function runLengthFt(run: PlacedRun, scale: DrawingScale | undefined) {
  return scale ? polylineLength(run.points) / scale.unitsPerFoot : null;
}

/** Drawing units per foot from a DXF's $INSUNITS; null when it has to be calibrated. */
export function dxfUnitsPerFoot(units: string): number | null {
  const perFoot: Record<string, number> = {
    Inches: 12,
    Feet: 1,
    Yards: 1 / 3,
    Millimeters: 304.8,
    Centimeters: 30.48,
    Decimeters: 3.048,
    Meters: 0.3048,
  };
  return perFoot[units] ?? null;
}

/** PDF points (1/72") per foot for common architectural plot scales. */
export const ARCHITECTURAL_SCALES = [
  { label: '1/8" = 1\'-0"', paperInchesPerFoot: 1 / 8 },
  { label: '3/16" = 1\'-0"', paperInchesPerFoot: 3 / 16 },
  { label: '1/4" = 1\'-0"', paperInchesPerFoot: 1 / 4 },
  { label: '3/8" = 1\'-0"', paperInchesPerFoot: 3 / 8 },
  { label: '1/2" = 1\'-0"', paperInchesPerFoot: 1 / 2 },
  { label: '3/4" = 1\'-0"', paperInchesPerFoot: 3 / 4 },
  { label: '1" = 1\'-0"', paperInchesPerFoot: 1 },
].map((scale) => ({ ...scale, unitsPerFoot: 72 * scale.paperInchesPerFoot }));

/** 12.5 -> 12'-6"  (rounded to the nearest inch). */
export function formatFeet(feet: number) {
  const totalInches = Math.round(feet * 12);
  const wholeFeet = Math.floor(totalInches / 12);
  const inches = totalInches - wholeFeet * 12;
  return `${wholeFeet}'-${inches}"`;
}

/**
 * Parses what a designer types for a real distance: 12'-6", 12' 6", 12'6,
 * 12.5, 12.5', 150". Returns feet, or null if it can't be read.
 */
export function parseFeet(input: string): number | null {
  const text = input.trim().replace(/[’′]/g, "'").replace(/[”″]/g, '"');
  if (!text) return null;

  const feetInches = /^(\d+(?:\.\d+)?)\s*'\s*-?\s*(\d+(?:\.\d+)?)?\s*"?$/.exec(text);
  if (feetInches) {
    const feet = Number(feetInches[1]) + (feetInches[2] ? Number(feetInches[2]) / 12 : 0);
    return feet > 0 ? feet : null;
  }
  const inchesOnly = /^(\d+(?:\.\d+)?)\s*"$/.exec(text);
  if (inchesOnly) {
    const feet = Number(inchesOnly[1]) / 12;
    return feet > 0 ? feet : null;
  }
  const plain = /^(\d+(?:\.\d+)?)$/.exec(text);
  if (plain) {
    const feet = Number(plain[1]);
    return feet > 0 ? feet : null;
  }
  return null;
}

/**
 * Room label nearest to a point (DXF drawings). Labels sit at room centers, so a
 * device by the wall of a large room can be far from its label; only labels
 * within half the drawing's size count, so devices placed outside the plan
 * (title block, notes) stay unassigned.
 */
export function nearestRoom(point: PlanPoint, rooms: RoomCandidate[], drawingExtent: number) {
  let best: RoomCandidate | null = null;
  let bestDistance = drawingExtent * 0.5;
  for (const room of rooms) {
    const gap = distance(point, room.position);
    if (gap <= bestDistance) {
      best = room;
      bestDistance = gap;
    }
  }
  return best?.label ?? "";
}

export function layerOf(item: PlanItem): LayerKey | undefined {
  return deviceType(item.typeId)?.layer;
}

/** Items and scales of one drawing moved onto another (a new revision of the same plan). */
export function moveDesignToDrawing(design: PlanDesign, fromDrawingId: string, toDrawingId: string): PlanDesign {
  return {
    ...design,
    items: design.items.map((item) =>
      item.drawingId === fromDrawingId ? { ...item, drawingId: toDrawingId } : item,
    ),
    scales: design.scales.map((scale) =>
      scale.drawingId === fromDrawingId ? { ...scale, drawingId: toDrawingId } : scale,
    ),
  };
}

export function removeDrawingFromDesign(design: PlanDesign, drawingId: string): PlanDesign {
  return {
    ...design,
    items: design.items.filter((item) => item.drawingId !== drawingId),
    scales: design.scales.filter((scale) => scale.drawingId !== drawingId),
    unverifiedSheets: design.unverifiedSheets.filter((sheet) => sheet.drawingId !== drawingId),
  };
}

const PDF_REVISION_REASON =
  "Carried over from the previous PDF. A revised PDF can be cropped, scaled or ordered differently, so check that devices still line up.";
const DXF_PENDING_REASON = "Carried over from the previous DXF. Checking whether the new drawing uses the same units and extents.";
const DXF_UNREAD_REASON =
  "Carried over from the previous DXF, which couldn't be compared with the new one. Check that devices still line up.";

/**
 * Moves a replaced drawing's items and scales onto its revision and marks
 * every sheet that received any as not verified. For a DXF, `previous` is the
 * replaced drawing's signature; a matching revision clears the mark later.
 */
export function carryDesignToRevision(
  design: PlanDesign,
  fromDrawingId: string,
  toDrawingId: string,
  kind: "pdf" | "dxf",
  previous: SheetSignature | null,
): PlanDesign {
  const pages = new Set<number>();
  for (const item of design.items) if (item.drawingId === fromDrawingId) pages.add(item.page);
  for (const scale of design.scales) if (scale.drawingId === fromDrawingId) pages.add(scale.page);
  const moved = moveDesignToDrawing(design, fromDrawingId, toDrawingId);
  const marks: UnverifiedSheet[] = [...pages].sort((a, b) => a - b).map((page) =>
    kind === "pdf"
      ? { drawingId: toDrawingId, page, reason: PDF_REVISION_REASON }
      : previous
        ? { drawingId: toDrawingId, page, reason: DXF_PENDING_REASON, previous }
        : { drawingId: toDrawingId, page, reason: DXF_UNREAD_REASON },
  );
  return {
    ...moved,
    unverifiedSheets: [
      ...moved.unverifiedSheets.filter((sheet) => sheet.drawingId !== fromDrawingId),
      ...marks,
    ],
  };
}

/** True when two DXF signatures describe the same coordinate space. */
export function sameSignature(a: SheetSignature, b: SheetSignature) {
  if (a.units !== b.units) return false;
  const size = Math.max(a.bounds.maxX - a.bounds.minX, a.bounds.maxY - a.bounds.minY, 1e-9);
  const tolerance = size * 1e-6;
  return (["minX", "minY", "maxX", "maxY"] as const).every(
    (key) => Math.abs(a.bounds[key] - b.bounds[key]) <= tolerance,
  );
}

function describeSignatureChange(before: SheetSignature, after: SheetSignature) {
  if (before.units !== after.units) {
    return `The new DXF uses ${after.units || "unknown"} units; the previous one used ${before.units || "unknown"}.`;
  }
  return "The new DXF's extents differ from the previous drawing's, so its origin or contents may have moved.";
}

/**
 * Once a replacing DXF has been read: clears the mark when it has the same
 * units and extents as the drawing it replaced, otherwise says what changed.
 * Returns the design unchanged when there is nothing to resolve.
 */
export function resolveDxfRevision(design: PlanDesign, drawingId: string, current: SheetSignature): PlanDesign {
  const pending = design.unverifiedSheets.find((sheet) => sheet.drawingId === drawingId && sheet.previous);
  const before = pending?.previous;
  if (!pending || !before) return design;
  const same = sameSignature(before, current);
  return {
    ...design,
    unverifiedSheets: design.unverifiedSheets.flatMap((sheet) => {
      if (sheet !== pending) return [sheet];
      return same
        ? []
        : [{ drawingId: sheet.drawingId, page: sheet.page, reason: describeSignatureChange(before, current) }];
    }),
  };
}

export function unverifiedSheet(design: PlanDesign, drawingId: string, page: number) {
  return design.unverifiedSheets.find((sheet) => sheet.drawingId === drawingId && sheet.page === page);
}

/** Keys (`drawingId:page`) of sheets whose alignment isn't verified. */
export function unverifiedSheetKeys(design: PlanDesign) {
  return new Set(design.unverifiedSheets.map((sheet) => `${sheet.drawingId}:${sheet.page}`));
}

/**
 * Applies a re-registration to one sheet: moves every item on it, turns
 * devices with it, and rescales the sheet's stored scale, then marks the sheet
 * verified. `yUp` is true for DXF coordinates (y grows upward).
 */
export function alignSheet(
  design: PlanDesign,
  drawingId: string,
  page: number,
  transform: Similarity,
  yUp: boolean,
): PlanDesign {
  // Never collapse a sheet or zero its scale: an unusable transform changes nothing.
  if (!usableAlignment(transform)) return design;
  const onSheet = (entry: { drawingId: string; page: number }) => entry.drawingId === drawingId && entry.page === page;
  // Device rotation is counter-clockwise on screen; in y-down coordinates the
  // transform's angle turns the other way.
  const turn = similarityAngleDeg(transform) * (yUp ? 1 : -1);
  const scale = similarityScale(transform);
  const aligned: PlanDesign = {
    ...design,
    items: design.items.map((item) => {
      if (!onSheet(item)) return item;
      return item.kind === "device"
        ? { ...item, at: applySimilarity(transform, item.at), rotation: normalizeDegrees(item.rotation + turn) }
        : { ...item, points: item.points.map((point) => applySimilarity(transform, point)) };
    }),
    scales: design.scales.map((entry) =>
      onSheet(entry) ? { ...entry, unitsPerFoot: entry.unitsPerFoot * scale } : entry,
    ),
  };
  return markSheetVerified(aligned, drawingId, page);
}

function normalizeDegrees(degrees: number) {
  const wrapped = ((degrees % 360) + 360) % 360;
  return wrapped > 180 ? wrapped - 360 : wrapped;
}

export function markSheetVerified(design: PlanDesign, drawingId: string, page: number): PlanDesign {
  return {
    ...design,
    unverifiedSheets: design.unverifiedSheets.filter(
      (sheet) => !(sheet.drawingId === drawingId && sheet.page === page),
    ),
  };
}
