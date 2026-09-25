import type { BomItem, ProjectMode, RetrofitSurvey, SystemName } from "./design";
import {
  clampReservePct,
  QTL_CATALOG_REVIEW_NOTE,
  qtlCandidatePowerSupply,
  qtlPowerSupplyById,
} from "./qtlCatalog";
import { isRecord, listWithDefaults, withDefaults } from "./sanitize";

export type ProjectTool =
  | "qtl"
  | "network"
  | "audio"
  | "video"
  | "cabling"
  | "budget"
  | "library"
  | "validate";

export type DesignTier = "Core" | "Refined" | "Signature";

export type QtlRun = {
  id: string;
  room: string;
  application: string;
  productId: string;
  fixtureQty: number;
  lengthFt: number;
  widthIn: number;
  depthIn: number;
  wattsPerFt: number;
  voltage: 24 | 48;
  cct: string;
  environment: "Dry" | "Damp" | "Wet";
  feed: "Left" | "Right" | "Center" | "TBD";
  dimming: string;
  lens: string;
  powerSupplyFamilyId: string;
  reservePct: number;
  selectedFamily: string;
  maxRunFt: number;
  notes: string;
};

export type NetworkPlan = {
  buildings: number;
  floors: number;
  wanGbps: number;
  wiredEndpoints: number;
  poeEndpoints: number;
  cameras: number;
  indoorAps: number;
  outdoorAps: number;
  targetBackboneGbps: number;
  rackLocations: number;
  targetPlatform: "UniFi" | "Mixed / Existing";
  notes: string;
};

export type AudioZone = {
  id: string;
  room: string;
  purpose: "Distributed Audio" | "TV / Casual" | "Critical Music" | "Home Theater" | "Outdoor";
  speakerCount: number;
  speakerType: "In-Ceiling" | "In-Wall" | "Invisible" | "Passive Soundbar" | "On-Wall" | "Outdoor";
  amplification: "Sonos Amp" | "AVR / Marantz" | "DSP / Multi-Channel Amp" | "Powered Speaker" | "TBD";
  control: "Savant" | "Sonos" | "Native App" | "Mixed" | "TBD";
  subwoofer: boolean;
  notes: string;
};

export type VideoChain = {
  id: string;
  room: string;
  displayBrand: "Sony" | "Samsung" | "Other" | "TBD";
  displayModel: string;
  source: "Apple TV" | "Cable / Satellite" | "Blu-ray" | "Local / Streaming Apps" | "None";
  control: "Savant IP" | "Savant IR" | "CEC" | "Native Remote" | "Other" | "TBD";
  audio: "Leon Passive Soundbar" | "Sonos Arc" | "AVR / Surround" | "TV Audio" | "Other" | "TBD";
  transport: "HDMI" | "Fiber HDMI" | "HDBaseT / Extender" | "Local";
  network: boolean;
  mount: "Fixed" | "Articulating" | "Future Automation" | "TBD";
  notes: string;
};

export type CableType =
  | "CAT6A"
  | "CAT6"
  | "Fiber OM4"
  | "RG6"
  | "14/2 Speaker"
  | "14/4 Speaker"
  | "16/2 Speaker"
  | "16/4 Speaker"
  | "18/2"
  | "18/4"
  | "Lutron / Control Cable"
  | "Shade Power / Control"
  | "HDMI / Fiber Pathway"
  | "Other";

export type CableRun = {
  id: string;
  from: string;
  to: string;
  cableType: CableType;
  measuredFt: number;
  verticalAllowanceFt: number;
  serviceLoopPct: number;
  wastePct: number;
  quantity: number;
  notes: string;
};

export type BudgetPlan = {
  total: number;
  tier: DesignTier;
  allocations: Record<SystemName, number>;
  notes: string;
};

export type ManufacturerSummary = {
  name: string;
  categories: string[];
  focus: string;
};

export type ProjectToolsState = {
  qtlRuns: QtlRun[];
  network: NetworkPlan;
  audioZones: AudioZone[];
  videoChains: VideoChain[];
  cableRuns: CableRun[];
  budget: BudgetPlan;
};

export type ValidationIssue = {
  id: string;
  severity: "Blocker" | "Warning" | "Info";
  system: string;
  message: string;
};

const systemAllocation: Record<SystemName, number> = {
  Lighting: 0,
  Lutron: 0,
  QTL: 0,
  Shades: 0,
  Network: 0,
  Audio: 0,
  Video: 0,
  Control: 0,
  Infrastructure: 0,
};

export const DEFAULT_TOOLS_STATE: ProjectToolsState = {
  qtlRuns: [],
  network: {
    buildings: 1,
    floors: 1,
    wanGbps: 1,
    wiredEndpoints: 12,
    poeEndpoints: 6,
    cameras: 0,
    indoorAps: 2,
    outdoorAps: 0,
    targetBackboneGbps: 2.5,
    rackLocations: 1,
    targetPlatform: "UniFi",
    notes: "",
  },
  audioZones: [],
  videoChains: [],
  cableRuns: [],
  budget: {
    total: 25000,
    tier: "Refined",
    allocations: systemAllocation,
    notes: "",
  },
};

/**
 * Saved tool state with missing or wrong-typed fields reset to defaults,
 * including inside every list item (see sanitize.ts). Items saved by older
 * versions may lack fields added since.
 */
export function normalizeTools(value: unknown, repairs?: string[]): ProjectToolsState {
  if (value !== undefined && !isRecord(value)) repairs?.push("tools");
  const parsed = isRecord(value) ? value : {};
  const budget = withDefaults(parsed.budget, DEFAULT_TOOLS_STATE.budget, "tools.budget", repairs);
  return {
    network: withDefaults(parsed.network, DEFAULT_TOOLS_STATE.network, "tools.network", repairs),
    budget: {
      ...budget,
      allocations: withDefaults(
        isRecord(parsed.budget) ? parsed.budget.allocations : undefined,
        DEFAULT_TOOLS_STATE.budget.allocations,
        "tools.budget.allocations",
        repairs,
      ),
    },
    qtlRuns: listWithDefaults(parsed.qtlRuns, newQtlRun, "tools.qtlRuns", repairs),
    audioZones: listWithDefaults(parsed.audioZones, newAudioZone, "tools.audioZones", repairs),
    videoChains: listWithDefaults(parsed.videoChains, newVideoChain, "tools.videoChains", repairs),
    cableRuns: listWithDefaults(parsed.cableRuns, newCableRun, "tools.cableRuns", repairs),
  };
}

export const MANUFACTURERS: ManufacturerSummary[] = [
  { name: "Lutron", categories: ["Lighting Control", "Shades", "Ketra"], focus: "Controls, keypads, load control, processors, shades, lighting." },
  { name: "DMF Lighting", categories: ["Architectural Lighting"], focus: "Downlights, adjustable, wall-wash, retrofit and new construction." },
  { name: "QTL", categories: ["Linear Lighting"], focus: "Cove, millwork, shelf, toe-kick and architectural linear systems." },
  { name: "Ubiquiti / UniFi", categories: ["Network", "Wi-Fi", "Protect", "Access"], focus: "Gateway, switching, APs, cameras, access control and rack ecosystem." },
  { name: "Leon Speakers", categories: ["Custom Audio", "Soundbars"], focus: "Custom-width passive soundbars and architectural audio." },
  { name: "Sonance", categories: ["Architectural Audio", "Invisible", "Outdoor"], focus: "In-ceiling, in-wall, invisible, outdoor and subwoofer solutions." },
  { name: "James by Sonance", categories: ["Custom Soundbars", "Small Aperture", "Subwoofers"], focus: "High-performance architectural and custom-length audio." },
  { name: "K-array", categories: ["Architectural Audio", "Luxury Audio"], focus: "Discreet line-source, flexible arrays, subs and amplifier ecosystem." },
  { name: "KSCAPE", categories: ["Audio + Lighting"], focus: "Integrated architectural rail combining lighting and audio." },
  { name: "Amina", categories: ["Invisible Audio"], focus: "Plaster-over invisible speakers and subwoofers." },
  { name: "Wisdom Audio", categories: ["Cinema", "Architectural Audio"], focus: "High-end planar / line-source architectural cinema solutions." },
  { name: "Stealth Acoustics", categories: ["Invisible Audio"], focus: "Invisible speakers and subwoofers." },
  { name: "Origin Acoustics", categories: ["Architectural Audio"], focus: "In-ceiling, in-wall and outdoor architectural audio." },
  { name: "Theory Audio Design", categories: ["Cinema", "Soundbars", "DSP"], focus: "High-output cinema and controller-driven loudspeaker systems." },
  { name: "Trinnov", categories: ["Cinema Processor", "Calibration"], focus: "Immersive audio processing, room optimization and calibration." },
  { name: "StormAudio", categories: ["Cinema Processor"], focus: "Immersive cinema processing, bass management and room correction." },
  { name: "Marantz", categories: ["AVR", "Cinema"], focus: "AV receivers and surround processing for residential systems." },
  { name: "Sonos", categories: ["Streaming Audio", "Amplification"], focus: "Simple client-facing streaming zones, amps and soundbars." },
  { name: "Savant", categories: ["Control", "AV Integration"], focus: "Control platform, remotes, IP/IR device integration and user experience." },
  { name: "Future Automation", categories: ["Mounting", "Backboxes"], focus: "Display mounts, recessed boxes and motorized solutions." },
  { name: "TRUFIG", categories: ["Flush Integration"], focus: "Architectural flush mounting and finish coordination." },
  { name: "IPORT", categories: ["Control Interface"], focus: "PoE-powered iPad mounts and dedicated control interfaces." },
  { name: "Blaze by Sonance", categories: ["Amplification", "DSP"], focus: "Multi-channel DSP amplification and preset-driven systems." },
  { name: "Sony", categories: ["Video"], focus: "Premium display options and integration targets." },
  { name: "Samsung", categories: ["Video"], focus: "Premium display options including design-oriented panels." },
  { name: "Apple", categories: ["Video Source"], focus: "Apple TV and client-facing streaming source integration." },
];

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function newQtlRun(): QtlRun {
  return {
    id: uid("qtl"),
    room: "",
    application: "Millwork",
    productId: "",
    fixtureQty: 1,
    lengthFt: 10,
    widthIn: 1,
    depthIn: 1,
    wattsPerFt: 4,
    voltage: 24,
    cct: "3000K",
    environment: "Dry",
    feed: "TBD",
    dimming: "0-10V",
    lens: "TBD",
    powerSupplyFamilyId: "qz",
    reservePct: 0,
    selectedFamily: "TBD / Select from QTL library",
    maxRunFt: 0,
    notes: "",
  };
}

export function qtlRunPower(run: QtlRun) {
  return Math.max(0, run.lengthFt * run.wattsPerFt * Math.max(1, run.fixtureQty ?? 1));
}

const CONTROL_PROTOCOLS: Array<[string, RegExp]> = [
  ["0-10V", /0\s*-\s*10\s*v/i],
  ["Phase", /phase|\belv\b|\bmlv\b|triac/i],
  ["DMX", /\bdmx\b/i],
  ["DALI", /\bdali\b/i],
  ["Non-dimming", /non-?dimming/i],
];

function controlProtocols(text: string) {
  return CONTROL_PROTOCOLS.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
}

/**
 * Reasons the run's selected PSU family cannot power it, from the catalog's
 * output voltages, listed environments and control protocols. Linear runs are
 * low-voltage DC, so the family must offer `${run.voltage}VDC`.
 */
export function qtlPsuMismatches(run: QtlRun): string[] {
  const family = qtlPowerSupplyById(run.powerSupplyFamilyId);
  if (!family) return [];
  const mismatches: string[] = [];

  const needed = `${run.voltage}VDC`;
  if (!family.outputVoltages.includes(needed)) {
    mismatches.push(
      family.acDc === "AC"
        ? `${family.name} is an AC transformer family (${family.outputVoltages.join(" / ")}); this run needs a ${needed} supply.`
        : `${family.name} outputs ${family.outputVoltages.join(" / ")}; this run needs ${needed}.`,
    );
  }

  const environments = family.environments.join(" ").toLowerCase();
  if (run.environment === "Wet" && !/wet|outdoor|pool/.test(environments)) {
    mismatches.push(`${family.name} lists no wet-location variant; this run is in a wet location.`);
  }
  if (run.environment === "Dry" && !/indoor/.test(environments)) {
    mismatches.push(
      `${family.name} is listed for ${family.environments.join(", ")} only; this run is an indoor dry location.`,
    );
  }

  const wanted = controlProtocols(run.dimming);
  const offered = controlProtocols(family.controls.join(" "));
  if (wanted.length > 0 && !wanted.some((protocol) => offered.includes(protocol))) {
    mismatches.push(
      `${family.name} lists ${family.controls.join(", ")} control; this run calls for ${wanted.join(" or ")}.`,
    );
  }

  return mismatches;
}

/**
 * Planning PSU candidate for a run, honoring its design reserve. A family that
 * doesn't fit the run gets no capacity candidate; `mismatches` says why.
 */
export function qtlRunPsuCandidate(run: QtlRun) {
  const candidate = qtlCandidatePowerSupply(
    run.powerSupplyFamilyId,
    qtlRunPower(run),
    run.reservePct,
  );
  if (!candidate) return null;
  const mismatches = qtlPsuMismatches(run);
  return {
    ...candidate,
    wattage: mismatches.length > 0 ? null : candidate.wattage,
    mismatches,
  };
}

export function qtlRunWarnings(run: QtlRun) {
  const warnings: string[] = [];
  if (!run.room.trim()) warnings.push("Room / location is not assigned.");
  if (run.lengthFt <= 0) warnings.push("Run length must be greater than zero.");
  if (run.wattsPerFt <= 0) warnings.push("Watts/ft is required for load calculation.");
  if (run.maxRunFt > 0 && run.lengthFt > run.maxRunFt) {
    warnings.push("Run exceeds the entered manufacturer maximum; split feeds/runs or change product.");
  }
  if (run.feed === "TBD") warnings.push("Feed location is still TBD.");
  if (!run.productId && run.selectedFamily.startsWith("TBD")) warnings.push("Exact QTL family/profile is not selected.");
  if ((run.fixtureQty ?? 1) <= 0) warnings.push("Fixture quantity must be greater than zero.");
  for (const mismatch of qtlPsuMismatches(run)) warnings.push(`PSU family mismatch: ${mismatch}`);
  if (clampReservePct(run.reservePct) === 0) {
    warnings.push("No design reserve: the PSU candidate is sized at 100% of its rating. Set a reserve per QTL loading guidance.");
  }
  return warnings;
}

export function newAudioZone(): AudioZone {
  return {
    id: uid("audio"),
    room: "",
    purpose: "Distributed Audio",
    speakerCount: 2,
    speakerType: "In-Ceiling",
    amplification: "Sonos Amp",
    control: "Sonos",
    subwoofer: false,
    notes: "",
  };
}

export function audioZoneWarnings(zone: AudioZone) {
  const warnings: string[] = [];
  if (!zone.room.trim()) warnings.push("Room is not assigned.");
  if (zone.speakerCount <= 0) warnings.push("Speaker quantity must be greater than zero.");
  if (zone.amplification === "TBD") {
    warnings.push("Amplification is TBD: passive speakers need an amplifier, or select Powered Speaker.");
  }
  if (zone.speakerCount > 4 && zone.amplification === "Sonos Amp") {
    warnings.push("High speaker count on one simple zone: verify impedance, wiring topology and amplifier load.");
  }
  if (zone.purpose === "Home Theater" && zone.amplification === "Sonos Amp") {
    warnings.push("Home theater should be reviewed as a dedicated surround/processor architecture, not only a distributed-audio zone.");
  }
  return warnings;
}

export function newVideoChain(): VideoChain {
  return {
    id: uid("video"),
    room: "",
    displayBrand: "Sony",
    displayModel: "",
    source: "Apple TV",
    control: "Savant IP",
    audio: "Leon Passive Soundbar",
    transport: "HDMI",
    network: true,
    mount: "Future Automation",
    notes: "",
  };
}

export function videoChainWarnings(chain: VideoChain) {
  const warnings: string[] = [];
  if (!chain.room.trim()) warnings.push("Room is not assigned.");
  if (chain.displayBrand === "TBD") warnings.push("Display brand/model is TBD.");
  if (chain.control === "TBD") warnings.push("Control path is not defined.");
  if (chain.source === "Apple TV" && !chain.network) warnings.push("Apple TV source should have reliable network connectivity.");
  if (chain.audio === "Leon Passive Soundbar") {
    warnings.push("Passive Leon soundbar requires amplifier channels and a defined audio signal path.");
  }
  if (chain.transport === "HDMI" && chain.notes.toLowerCase().includes("long run")) {
    warnings.push("Long HDMI pathway noted; evaluate fiber HDMI or an extender solution.");
  }
  if (chain.mount === "Future Automation") {
    warnings.push("Verify exact display VESA/weight/travel against the selected Future Automation mount/backbox.");
  }
  return warnings;
}

export function newCableRun(): CableRun {
  return {
    id: uid("cable"),
    from: "Rack",
    to: "",
    cableType: "CAT6A",
    measuredFt: 50,
    verticalAllowanceFt: 10,
    serviceLoopPct: 10,
    wastePct: 10,
    quantity: 1,
    notes: "",
  };
}

export function cableRunTotal(run: CableRun) {
  const base = Math.max(0, run.measuredFt + run.verticalAllowanceFt);
  const multiplier = 1 + Math.max(0, run.serviceLoopPct) / 100 + Math.max(0, run.wastePct) / 100;
  // Round away floating-point noise first: 60 × 1.2 is 72.00000000000001, not 73 ft.
  const feet = Math.round(base * multiplier * Math.max(1, run.quantity) * 1e6) / 1e6;
  return Math.ceil(feet);
}

export function cableSummary(runs: CableRun[]) {
  const totals = new Map<CableType, number>();
  for (const run of runs) {
    totals.set(run.cableType, (totals.get(run.cableType) ?? 0) + cableRunTotal(run));
  }
  return Array.from(totals.entries()).map(([type, feet]) => ({ type, feet }));
}

export function networkDerived(plan: NetworkPlan) {
  const endpointPorts = plan.wiredEndpoints + plan.poeEndpoints + plan.cameras + plan.indoorAps + plan.outdoorAps;
  const portTarget = Math.max(8, Math.ceil(endpointPorts * 1.25));
  const poeTarget = Math.ceil((plan.poeEndpoints + plan.cameras + plan.indoorAps + plan.outdoorAps) * 1.2);
  const multiBuilding = plan.buildings > 1;
  const multiFloor = plan.floors > 1;
  const recommendations: string[] = [
    `Plan at least ${portTarget} switch ports including ~25% working reserve.`,
    `Plan at least ${poeTarget} PoE-capable ports including reserve.`,
    `Gateway should sustain the target WAN performance of ${plan.wanGbps} Gbps with the project's security features enabled.`,
    `Backbone target: ${plan.targetBackboneGbps} Gbps or greater where the endpoint/uplink design requires it.`,
  ];
  if (multiBuilding) recommendations.push("Use a site-level topology: building distribution, fiber/appropriate inter-building uplinks, outdoor-rated pathways and surge/grounding coordination.");
  if (multiFloor) recommendations.push("Plan vertical backbone/riser capacity and per-floor distribution rather than treating the property as one flat LAN.");
  if (plan.outdoorAps > 0) recommendations.push("Outdoor APs require environment-rated mounting, weather exposure, pathway and RF/site coverage review.");
  return { endpointPorts, portTarget, poeTarget, recommendations };
}

export function budgetTotals(plan: BudgetPlan) {
  const allocated = Object.values(plan.allocations).reduce((sum, value) => sum + Math.max(0, value), 0);
  return {
    allocated,
    remaining: plan.total - allocated,
    percent: plan.total > 0 ? (allocated / plan.total) * 100 : 0,
  };
}

export function validateProject(input: {
  bom: BomItem[];
  mode: ProjectMode;
  survey: RetrofitSurvey;
  tools: ProjectToolsState;
}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (severity: ValidationIssue["severity"], system: string, message: string) =>
    issues.push({ id: uid("check"), severity, system, message });

  for (const run of input.tools.qtlRuns) {
    for (const warning of qtlRunWarnings(run)) add("Warning", "QTL", `${run.room || "Unassigned run"}: ${warning}`);
  }

  for (const zone of input.tools.audioZones) {
    for (const warning of audioZoneWarnings(zone)) add("Warning", "Audio", `${zone.room || "Unassigned zone"}: ${warning}`);
  }

  for (const chain of input.tools.videoChains) {
    for (const warning of videoChainWarnings(chain)) add("Warning", "Video", `${chain.room || "Unassigned video system"}: ${warning}`);
  }

  const net = networkDerived(input.tools.network);
  if (input.tools.network.indoorAps + input.tools.network.outdoorAps === 0) {
    add("Info", "Network", "No access points are currently included in the network plan.");
  }
  if (input.tools.network.rackLocations <= 0) {
    add("Warning", "Network", "No rack / equipment location is assigned.");
  }
  if (net.portTarget > 48) {
    add("Info", "Network", "Port target exceeds a typical single-switch design; plan distribution and uplinks intentionally.");
  }

  if (input.tools.cableRuns.length === 0) {
    add("Info", "Infrastructure", "No cable runs have been entered yet.");
  }
  for (const run of input.tools.cableRuns) {
    if (!run.to.trim()) add("Warning", "Infrastructure", `${run.cableType}: destination is not assigned.`);
    if (run.cableType === "CAT6" && input.tools.network.targetBackboneGbps > 1) {
      add("Info", "Infrastructure", "CAT6 run exists in a multi-gig design. Verify distance/performance; prefer CAT6A where the design requires predictable higher-speed headroom.");
    }
  }

  const budget = budgetTotals(input.tools.budget);
  if (budget.remaining < 0) add("Blocker", "Budget", `Allocated system budget is over target by $${Math.abs(budget.remaining).toLocaleString()}.`);
  if (input.tools.budget.total <= 0) add("Warning", "Budget", "Project target budget is not defined.");

  if (input.mode === "retrofit" && input.survey.controlPlatform === "Unknown") {
    add("Warning", "Retrofit", "Existing lighting-control platform is still unknown.");
  }
  if (input.mode === "retrofit" && input.survey.networkPlatform === "Unknown") {
    add("Warning", "Retrofit", "Existing network platform is still unknown.");
  }

  const reviewBom = input.bom.filter((item) => item.confidence === "Review");
  if (reviewBom.length > 0) add("Info", "BOM", `${reviewBom.length} preliminary BOM item(s) still require design/field verification.`);

  if (issues.length === 0) add("Info", "Project", "No blocking issues found by the currently implemented checks.");
  return issues;
}

/** Blockers and warnings first; what the inspector's Design Issues panel shows. */
export function issueSummary(issues: ValidationIssue[]) {
  const blockers = issues.filter((issue) => issue.severity === "Blocker");
  const warnings = issues.filter((issue) => issue.severity === "Warning");
  const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;
  return {
    blockers: blockers.length,
    warnings: warnings.length,
    actionable: [...blockers, ...warnings],
    headline:
      blockers.length + warnings.length === 0
        ? "No blockers or warnings from the current checks."
        : [blockers.length ? plural(blockers.length, "blocker") : "", warnings.length ? plural(warnings.length, "warning") : ""]
            .filter(Boolean)
            .join(", "),
  };
}

export function exportCsv(filename: string, rows: string[][]) {
  const cell = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const csv = rows.map((row) => row.map(cell).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}


export function generateToolBom(
  tools: ProjectToolsState,
  mode: ProjectMode,
): BomItem[] {
  const items: BomItem[] = [];
  const status = mode === "retrofit" ? "Verify" : "Add";

  for (const rawRun of tools.qtlRuns) {
    const run: QtlRun = {
      ...rawRun,
      productId: rawRun.productId ?? "",
      fixtureQty: rawRun.fixtureQty ?? 1,
      lens: rawRun.lens ?? "TBD",
      powerSupplyFamilyId: rawRun.powerSupplyFamilyId ?? "qz",
      reservePct: rawRun.reservePct ?? 0,
    };
    const psu = qtlPowerSupplyById(run.powerSupplyFamilyId);
    const candidate = qtlRunPsuCandidate(run);

    items.push({
      id: `tool-${run.id}-fixture`,
      system: "QTL",
      manufacturer: "QTL",
      item: `${run.application} — ${run.selectedFamily}`,
      quantity: `${run.fixtureQty} × ${run.lengthFt.toFixed(2)} ft`,
      status,
      confidence: run.selectedFamily.startsWith("TBD") ? "Review" : "Medium",
      basis: `${run.room || "Unassigned"}; ${run.wattsPerFt} W/ft; ${qtlRunPower(run).toFixed(1)} W connected load; ${run.cct}; ${run.environment}; ${run.lens}; ${run.dimming}.`,
    });

    items.push({
      id: `tool-${run.id}-driver`,
      system: "QTL",
      manufacturer: "QTL",
      item: `${psu?.name ?? "Power supply / driver"} — ${run.room || "Unassigned"}`,
      quantity: "Engineering / quote selection",
      status,
      confidence: "Review",
      basis: candidate?.mismatches.length
        ? `Selected ${psu?.name ?? "PSU"} family does not fit this run: ${candidate.mismatches.join(" ")} Choose a compatible family before sizing.`
        : candidate?.wattage
        ? `Smallest capacity in the selected ${psu?.name ?? "PSU"} family that carries ${qtlRunPower(run).toFixed(1)} W with a ${clampReservePct(run.reservePct)}% design reserve is ${candidate.wattage}W. This is a planning candidate only; exact QTL model, channel grouping, protocol, environment and Class 2 architecture must be verified in the current QTL configuration/quote. ${QTL_CATALOG_REVIEW_NOTE}`
        : `Connected load is ${qtlRunPower(run).toFixed(1)} W. Selected family does not have a simple single-capacity match in the seeded data; engineering/quote review required.`,
    });
  }

  if (
    tools.network.wiredEndpoints +
      tools.network.poeEndpoints +
      tools.network.cameras +
      tools.network.indoorAps +
      tools.network.outdoorAps >
    0
  ) {
    const derived = networkDerived(tools.network);

    items.push({
      id: "tool-network-gateway",
      system: "Network",
      manufacturer: tools.network.targetPlatform === "UniFi" ? "Ubiquiti / UniFi" : undefined,
      item: "Gateway / router",
      quantity: "1",
      status,
      confidence: "Medium",
      basis: `Size for ${tools.network.wanGbps} Gbps WAN target and project security/features. Exact model remains requirement-driven.`,
    });

    items.push({
      id: "tool-network-switching",
      system: "Network",
      manufacturer: tools.network.targetPlatform === "UniFi" ? "Ubiquiti / UniFi" : undefined,
      item: "Managed PoE switching",
      quantity: `${derived.portTarget}+ port working target`,
      status,
      confidence: "Medium",
      basis: `Current endpoint model needs ${derived.endpointPorts} ports; working target includes reserve and at least ${derived.poeTarget} PoE-capable ports.`,
    });

    if (tools.network.indoorAps > 0) {
      items.push({
        id: "tool-network-indoor-aps",
        system: "Network",
        manufacturer: tools.network.targetPlatform === "UniFi" ? "Ubiquiti / UniFi" : undefined,
        item: "Indoor Wi-Fi access points",
        quantity: String(tools.network.indoorAps),
        status,
        confidence: "Review",
        basis: "Exact AP family/location must follow floorplan geometry, wall materials, target bands and predictive/field RF validation.",
      });
    }

    if (tools.network.outdoorAps > 0) {
      items.push({
        id: "tool-network-outdoor-aps",
        system: "Network",
        manufacturer: tools.network.targetPlatform === "UniFi" ? "Ubiquiti / UniFi" : "UniFi / suitable outdoor platform",
        item: "Outdoor Wi-Fi access points",
        quantity: String(tools.network.outdoorAps),
        status,
        confidence: "Review",
        basis: "Outdoor-rated model, mounting, pathway, weather exposure and site RF coverage must be verified.",
      });
    }
  }

  for (const zone of tools.audioZones) {
    items.push({
      id: `tool-${zone.id}-speakers`,
      system: "Audio",
      manufacturer:
        zone.speakerType === "Passive Soundbar"
          ? "Leon / James / project-selected"
          : zone.speakerType === "Invisible"
            ? "Sonance / Amina / Stealth / project-selected"
            : "Sonance / James / K-array / project-selected",
      item: `${zone.speakerType} speakers — ${zone.room || "Unassigned"}`,
      quantity: String(zone.speakerCount),
      status,
      confidence: "Review",
      basis: `${zone.purpose}; control: ${zone.control}; exact model requires geometry, performance, aesthetics and budget.`,
    });

    if (zone.amplification !== "Powered Speaker") {
      items.push({
        id: `tool-${zone.id}-amp`,
        system: "Audio",
        manufacturer:
          zone.amplification === "Sonos Amp"
            ? "Sonos"
            : zone.amplification === "AVR / Marantz"
              ? "Marantz / project-selected"
              : undefined,
        item: `Amplification — ${zone.room || "Unassigned"}`,
        quantity: "1 zone allowance",
        status,
        confidence: zone.amplification === "TBD" ? "Review" : "Medium",
        basis: `Selected strategy: ${zone.amplification}. Final channel count, impedance, power and DSP/preset requirements must be validated.`,
      });
    }

    if (zone.subwoofer) {
      items.push({
        id: `tool-${zone.id}-sub`,
        system: "Audio",
        item: `Subwoofer / low-frequency solution — ${zone.room || "Unassigned"}`,
        quantity: "1+",
        status,
        confidence: "Review",
        basis: "Placement, room modes, isolation/rattle control, amplification, concealment and ventilation require review.",
      });
    }
  }

  for (const chain of tools.videoChains) {
    items.push({
      id: `tool-${chain.id}-display`,
      system: "Video",
      manufacturer: chain.displayBrand === "TBD" ? undefined : chain.displayBrand,
      item: `Display — ${chain.room || "Unassigned"}`,
      quantity: "1",
      status,
      confidence: chain.displayModel.trim() ? "Medium" : "Review",
      basis: chain.displayModel.trim()
        ? `Entered model/size: ${chain.displayModel}.`
        : "Exact display model/size remains TBD.",
    });

    if (chain.source !== "None") {
      items.push({
        id: `tool-${chain.id}-source`,
        system: "Video",
        manufacturer: chain.source === "Apple TV" ? "Apple" : undefined,
        item: `Source — ${chain.source}`,
        quantity: "1",
        status,
        confidence: "Medium",
        basis: `Room: ${chain.room || "Unassigned"}; control path: ${chain.control}; transport: ${chain.transport}.`,
      });
    }

    items.push({
      id: `tool-${chain.id}-mount`,
      system: "Video",
      manufacturer: chain.mount === "Future Automation" ? "Future Automation" : undefined,
      item: `Display mount / backbox — ${chain.room || "Unassigned"}`,
      quantity: "1",
      status,
      confidence: "Review",
      basis: `Selected strategy: ${chain.mount}. Verify exact display dimensions, VESA, weight, wall construction, travel and soundbar relationship.`,
    });

    if (chain.audio === "Leon Passive Soundbar") {
      items.push({
        id: `tool-${chain.id}-audio`,
        system: "Audio",
        manufacturer: "Leon Speakers",
        item: `Custom passive soundbar — ${chain.room || "Unassigned"}`,
        quantity: "1",
        status,
        confidence: "Review",
        basis: "Exact Leon configuration should follow final display width, channel configuration, finish, amplification and mounting/elevation details.",
      });
    } else if (chain.audio === "Sonos Arc") {
      items.push({
        id: `tool-${chain.id}-audio`,
        system: "Audio",
        manufacturer: "Sonos",
        item: `Sonos Arc / TV audio — ${chain.room || "Unassigned"}`,
        quantity: "1",
        status,
        confidence: "Medium",
        basis: "Verify display audio return/control path, network, mounting/clearance and any custom Leon enclosure/frame request.",
      });
    }
  }

  for (const run of tools.cableRuns) {
    items.push({
      id: `tool-${run.id}-cable`,
      system: "Infrastructure",
      item: `${run.cableType} cabling — ${run.from} to ${run.to || "TBD"}`,
      quantity: `${cableRunTotal(run)} ft est.`,
      status,
      confidence: run.to.trim() ? "Medium" : "Review",
      basis: `Includes measured path, vertical allowance, ${run.serviceLoopPct}% service loop, ${run.wastePct}% waste, qty ${run.quantity}.`,
    });
  }

  return items;
}
