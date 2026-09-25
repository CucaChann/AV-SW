import { deviceType, layerDefinition } from "./deviceCatalog";
import type { BomItem } from "./design";
import {
  dxfUnitsPerFoot,
  formatFeet,
  runLengthFt,
  scaleFor,
  type DrawingScale,
  type PlanDesign,
  type PlanItem,
} from "./planDesign";
import { cableRunTotal, newCableRun } from "./projectTools";

/** A sheet's scale: its stored calibration, or the DXF's own units. */
export function effectiveScale(
  design: PlanDesign,
  drawingId: string,
  page: number,
  dxfUnits: string | null,
): DrawingScale | undefined {
  const stored = scaleFor(design, drawingId, page);
  if (stored || !dxfUnits) return stored;
  const unitsPerFoot = dxfUnitsPerFoot(dxfUnits);
  return unitsPerFoot
    ? { drawingId, page, unitsPerFoot, label: `DXF ${dxfUnits.toLowerCase()}` }
    : undefined;
}

export type ScaleLookup = (item: PlanItem) => DrawingScale | undefined;

function roomsOf(items: PlanItem[]) {
  const rooms = Array.from(new Set(items.map((item) => item.room.trim()).filter(Boolean)));
  return rooms.length ? rooms.join(", ") : "rooms not assigned";
}

/**
 * BOM lines for everything placed on the plan, grouped by type, brand, model
 * (and cable type), plus the preliminary placeholder lines they replace.
 */
export function designBom(design: PlanDesign, scaleOf: ScaleLookup) {
  const groups = new Map<string, PlanItem[]>();
  for (const item of design.items) {
    const key = [item.typeId, item.brand.trim(), item.model.trim(), item.kind === "run" ? item.cableType : ""].join("|");
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  const supersedes = new Set<string>();
  const items: BomItem[] = [];

  for (const [key, group] of groups) {
    const type = deviceType(group[0].typeId);
    if (!type) continue;
    if (type.supersedes) supersedes.add(type.supersedes);

    const brand = group[0].brand.trim();
    const model = group[0].model.trim();
    const layer = layerDefinition(type.layer).name;
    const notes: string[] = [`Placed on the plan (${layer} layer): ${roomsOf(group)}.`];
    let quantity = String(group.length);
    let name = model ? `${type.name} — ${model}` : type.name;
    let measured = true;

    if (type.shape === "line") {
      const lengths = group.map((item) => (item.kind === "run" ? runLengthFt(item, scaleOf(item)) : null));
      measured = lengths.every((length) => length !== null);
      const total = lengths.reduce<number>((sum, length) => sum + (length ?? 0), 0);
      const dimension = type.measures === "shade-width" || type.measures === "screen-width" ? "width" : "length";

      if (type.measures === "cable") {
        const cableType = group[0].kind === "run" ? group[0].cableType : "";
        const defaults = newCableRun();
        const withAllowances = group.reduce((sum, item, index) => {
          const run = { ...defaults, measuredFt: lengths[index] ?? 0, quantity: item.quantity };
          return sum + cableRunTotal(run);
        }, 0);
        name = model ? `${cableType} cable — ${model}` : `${cableType} cable`;
        quantity = measured
          ? `${group.length} run${group.length === 1 ? "" : "s"} · ${Math.ceil(total)} ft measured · ${withAllowances} ft with allowances`
          : `${group.length} run${group.length === 1 ? "" : "s"} · length needs a sheet scale`;
        notes.push(
          `Allowances follow the Cabling builder defaults (${defaults.verticalAllowanceFt} ft vertical per run, ${defaults.serviceLoopPct}% service loop, ${defaults.wastePct}% waste).`,
        );
      } else {
        quantity = measured
          ? `${group.length} · ${formatFeet(total)} total ${dimension}`
          : `${group.length} · ${dimension} needs a sheet scale`;
      }
      if (!measured) notes.push("Set the sheet scale to measure these runs.");
    }

    if (!model) notes.push("Model not selected yet.");

    items.push({
      id: `plan-${key}`,
      system: type.system,
      manufacturer: brand || undefined,
      item: name,
      quantity,
      // Placed devices are new scope in both new builds and retrofits.
      status: "Add",
      confidence: model && measured ? "Medium" : "Review",
      basis: notes.join(" "),
    });
  }

  return { items, supersedes };
}

/** Preliminary lines minus those replaced by placed devices, then the plan lines. */
export function mergeDesignBom(preliminary: BomItem[], design: ReturnType<typeof designBom>) {
  return [...preliminary.filter((item) => !design.supersedes.has(item.item)), ...design.items];
}
