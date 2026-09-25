import {
  deviceType,
  LAYER_DEFINITIONS,
  type LayerKey,
} from "./deviceCatalog";
import type { RoomCandidate } from "./dxf";
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

export type PlanDesign = {
  layers: DesignLayer[];
  items: PlanItem[];
  scales: DrawingScale[];
};

export function defaultDesign(): PlanDesign {
  return {
    layers: LAYER_DEFINITIONS.map((layer) => ({ key: layer.key, visible: true, locked: false })),
    items: [],
    scales: [],
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
  }

  return design;
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
  };
}
