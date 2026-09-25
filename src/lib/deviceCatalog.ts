import type { CableType } from "./projectTools";
import type { SystemName } from "./design";

/**
 * Generic device types that can be placed on a floor plan, grouped by design
 * layer. Brands are suggestions (the first is the default); model numbers and
 * specs come from the product library, never from this file.
 */

export type LayerKey =
  | "lighting"
  | "lighting-control"
  | "shades"
  | "audio"
  | "video"
  | "network"
  | "control"
  | "cabling";

export type LayerDefinition = {
  key: LayerKey;
  name: string;
  system: SystemName;
  color: string;
};

export const LAYER_DEFINITIONS: LayerDefinition[] = [
  { key: "lighting", name: "Lighting", system: "Lighting", color: "#f2b84b" },
  { key: "lighting-control", name: "Lighting Control", system: "Lutron", color: "#a78bfa" },
  { key: "shades", name: "Shades", system: "Shades", color: "#2dd4bf" },
  { key: "audio", name: "Audio", system: "Audio", color: "#60a5fa" },
  { key: "video", name: "Video", system: "Video", color: "#f472b6" },
  { key: "network", name: "Network", system: "Network", color: "#4ade80" },
  { key: "control", name: "Control & Touch Panels", system: "Control", color: "#fb923c" },
  { key: "cabling", name: "Cabling", system: "Infrastructure", color: "#94a3b8" },
];

export type SymbolShape = "circle" | "square" | "diamond" | "triangle" | "hexagon" | "wide";

export type DeviceType = {
  id: string;
  layer: LayerKey;
  name: string;
  /** Short code shown in the symbol and used for tags (KP-1, KP-2…). */
  code: string;
  /** "point" devices are placed with one click; "line" items are drawn as runs. */
  shape: "point" | "line";
  symbol: SymbolShape;
  system: SystemName;
  brands: string[];
  /** What a drawn line measures, for line items. */
  measures?: "cable" | "linear-light" | "shade-width" | "screen-width" | "pathway";
  /**
   * Preliminary BOM placeholder this type replaces once devices of it are
   * placed (matched by BOM item name).
   */
  supersedes?: string;
};

const HIGH_END_SPEAKERS = ["Sonance", "James by Sonance", "Revel", "Leon Speakers", "Origin Acoustics", "K-array"];

export const DEVICE_TYPES: DeviceType[] = [
  // Lighting
  { id: "downlight", layer: "lighting", name: "Downlight", code: "DL", shape: "point", symbol: "circle", system: "Lighting", brands: ["DMF Lighting", "Lutron Ketra"], supersedes: "Architectural downlights / fixtures" },
  { id: "accent-light", layer: "lighting", name: "Adjustable / accent", code: "AJ", shape: "point", symbol: "diamond", system: "Lighting", brands: ["DMF Lighting", "Lutron Ketra"] },
  { id: "wall-wash", layer: "lighting", name: "Wall wash", code: "WW", shape: "point", symbol: "triangle", system: "Lighting", brands: ["DMF Lighting", "Lutron Ketra"] },
  { id: "pendant", layer: "lighting", name: "Pendant / decorative", code: "PD", shape: "point", symbol: "hexagon", system: "Lighting", brands: [] },
  { id: "sconce", layer: "lighting", name: "Wall sconce", code: "SC", shape: "point", symbol: "square", system: "Lighting", brands: [] },
  { id: "step-light", layer: "lighting", name: "Step / low-level light", code: "ST", shape: "point", symbol: "square", system: "Lighting", brands: [] },
  { id: "exterior-light", layer: "lighting", name: "Exterior / landscape light", code: "EX", shape: "point", symbol: "circle", system: "Lighting", brands: [] },
  { id: "linear-light", layer: "lighting", name: "Linear LED run", code: "LN", shape: "line", symbol: "wide", system: "QTL", brands: ["QTL"], measures: "linear-light", supersedes: "Linear LED runs / assemblies" },

  // Lighting control
  { id: "keypad", layer: "lighting-control", name: "Keypad", code: "KP", shape: "point", symbol: "square", system: "Lutron", brands: ["Lutron", "Savant"], supersedes: "Keypads / control stations" },
  { id: "dimmer", layer: "lighting-control", name: "Dimmer / switch", code: "DM", shape: "point", symbol: "square", system: "Lutron", brands: ["Lutron", "Savant"] },
  { id: "occupancy-sensor", layer: "lighting-control", name: "Occupancy / vacancy sensor", code: "OS", shape: "point", symbol: "triangle", system: "Lutron", brands: ["Lutron"] },
  { id: "lighting-processor", layer: "lighting-control", name: "Lighting processor", code: "PR", shape: "point", symbol: "hexagon", system: "Lutron", brands: ["Lutron"], supersedes: "HomeWorks processor / control platform" },
  { id: "load-panel", layer: "lighting-control", name: "Power / load panel", code: "LP", shape: "point", symbol: "wide", system: "Lutron", brands: ["Lutron"] },

  // Shades
  { id: "roller-shade", layer: "shades", name: "Roller shade (window width)", code: "SH", shape: "line", symbol: "wide", system: "Shades", brands: ["Lutron"], measures: "shade-width", supersedes: "Sivoia QS shades / drapery treatments" },
  { id: "drapery", layer: "shades", name: "Drapery track", code: "DR", shape: "line", symbol: "wide", system: "Shades", brands: ["Lutron"], measures: "shade-width" },
  { id: "shade-panel", layer: "shades", name: "Shade power panel", code: "SP", shape: "point", symbol: "wide", system: "Shades", brands: ["Lutron"], supersedes: "Shade power / control infrastructure" },

  // Audio
  { id: "ceiling-speaker", layer: "audio", name: "In-ceiling speaker", code: "SPK", shape: "point", symbol: "circle", system: "Audio", brands: HIGH_END_SPEAKERS, supersedes: "Architectural in-wall / in-ceiling / invisible speakers" },
  { id: "wall-speaker", layer: "audio", name: "In-wall speaker", code: "SPW", shape: "point", symbol: "square", system: "Audio", brands: HIGH_END_SPEAKERS, supersedes: "Architectural in-wall / in-ceiling / invisible speakers" },
  { id: "invisible-speaker", layer: "audio", name: "Invisible speaker", code: "INV", shape: "point", symbol: "diamond", system: "Audio", brands: ["Sonance", "Amina", "Stealth Acoustics"], supersedes: "Architectural in-wall / in-ceiling / invisible speakers" },
  { id: "lcr-soundbar", layer: "audio", name: "LCR / custom soundbar", code: "LCR", shape: "point", symbol: "wide", system: "Audio", brands: ["Leon Speakers", "James by Sonance", "Sonance", "Revel"], supersedes: "Passive LCR / custom soundbar packages" },
  { id: "subwoofer", layer: "audio", name: "Subwoofer", code: "SUB", shape: "point", symbol: "hexagon", system: "Audio", brands: ["James by Sonance", "Sonance", "Revel", "Wisdom Audio"] },
  { id: "outdoor-speaker", layer: "audio", name: "Outdoor / landscape speaker", code: "OUT", shape: "point", symbol: "triangle", system: "Audio", brands: ["Sonance", "Origin Acoustics", "Revel", "James by Sonance"] },
  { id: "amplifier", layer: "audio", name: "Amplifier / DSP location", code: "AMP", shape: "point", symbol: "wide", system: "Audio", brands: ["Sonance", "Blaze by Sonance", "James by Sonance"], supersedes: "Amplification / DSP" },

  // Video
  { id: "display", layer: "video", name: "Display / TV", code: "TV", shape: "point", symbol: "wide", system: "Video", brands: ["Sony", "Samsung"], supersedes: "Displays" },
  { id: "projector", layer: "video", name: "Projector", code: "PJ", shape: "point", symbol: "diamond", system: "Video", brands: ["Sony"] },
  { id: "screen", layer: "video", name: "Projection screen (width)", code: "SCR", shape: "line", symbol: "wide", system: "Video", brands: [], measures: "screen-width" },
  { id: "tv-mount", layer: "video", name: "Mount / recessed box", code: "MT", shape: "point", symbol: "square", system: "Video", brands: ["Future Automation"], supersedes: "Mounts / recessed wall boxes" },
  { id: "video-endpoint", layer: "video", name: "Video endpoint / HDMI drop", code: "VE", shape: "point", symbol: "triangle", system: "Video", brands: [] },
  { id: "av-source", layer: "video", name: "AV source location", code: "SRC", shape: "point", symbol: "hexagon", system: "Video", brands: ["Apple", "Savant"] },

  // Network
  { id: "access-point", layer: "network", name: "Wi-Fi access point", code: "AP", shape: "point", symbol: "circle", system: "Network", brands: ["Ubiquiti / UniFi"], supersedes: "Wi-Fi access points" },
  { id: "outdoor-ap", layer: "network", name: "Outdoor access point", code: "APO", shape: "point", symbol: "circle", system: "Network", brands: ["Ubiquiti / UniFi"], supersedes: "Wi-Fi access points" },
  { id: "data-drop", layer: "network", name: "Data drop", code: "D", shape: "point", symbol: "triangle", system: "Network", brands: [], supersedes: "CAT6A / structured-cabling drops" },
  { id: "camera", layer: "network", name: "Camera", code: "CAM", shape: "point", symbol: "diamond", system: "Network", brands: ["Ubiquiti / UniFi"] },
  { id: "rack", layer: "network", name: "Rack / network location", code: "RK", shape: "point", symbol: "wide", system: "Infrastructure", brands: [], supersedes: "AV / network rack or equipment enclosure" },

  // Control & touch panels
  { id: "touch-panel", layer: "control", name: "Touch panel", code: "TP", shape: "point", symbol: "square", system: "Control", brands: ["Savant", "Lutron"] },
  { id: "ipad-dock", layer: "control", name: "iPad dock / mount", code: "IP", shape: "point", symbol: "square", system: "Control", brands: ["IPORT"] },
  { id: "remote", layer: "control", name: "Remote / host location", code: "RM", shape: "point", symbol: "diamond", system: "Control", brands: ["Savant"] },
  { id: "thermostat", layer: "control", name: "Thermostat", code: "TH", shape: "point", symbol: "circle", system: "Control", brands: ["Savant", "Lutron"] },
  { id: "control-host", layer: "control", name: "Control host / processor", code: "CH", shape: "point", symbol: "hexagon", system: "Control", brands: ["Savant"] },

  // Cabling
  { id: "cable-run", layer: "cabling", name: "Cable run", code: "CBL", shape: "line", symbol: "wide", system: "Infrastructure", brands: [], measures: "cable" },
  { id: "conduit", layer: "cabling", name: "Conduit / pathway", code: "CND", shape: "line", symbol: "wide", system: "Infrastructure", brands: [], measures: "pathway" },
  { id: "wall-plate", layer: "cabling", name: "Wall plate / termination", code: "WP", shape: "point", symbol: "triangle", system: "Infrastructure", brands: [] },
];

export const CABLE_TYPES: CableType[] = [
  "CAT6A",
  "CAT6",
  "Fiber OM4",
  "RG6",
  "14/2 Speaker",
  "14/4 Speaker",
  "16/2 Speaker",
  "16/4 Speaker",
  "18/2",
  "18/4",
  "Lutron / Control Cable",
  "Shade Power / Control",
  "HDMI / Fiber Pathway",
  "Other",
];

const TYPES_BY_ID = new Map(DEVICE_TYPES.map((type) => [type.id, type]));

export function deviceType(id: string) {
  return TYPES_BY_ID.get(id);
}

export function typesForLayer(layer: LayerKey) {
  return DEVICE_TYPES.filter((type) => type.layer === layer);
}

export function layerDefinition(key: LayerKey) {
  return LAYER_DEFINITIONS.find((layer) => layer.key === key)!;
}
