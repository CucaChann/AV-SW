import type {
  DrawingAnalysis,
  DraftRecommendation,
} from "./dxf";
import { withDefaults } from "./sanitize";

export type SystemName = DraftRecommendation["system"];
export type ProjectMode = "new-build" | "retrofit";
export type InspectorView = "system" | "bom" | "analysis" | "survey";

export type BomStatus = "Add" | "Replace" | "Reuse" | "Verify";
export type BomConfidence = "High" | "Medium" | "Review";

export type BomItem = {
  id: string;
  system: SystemName;
  manufacturer?: string;
  item: string;
  quantity: string;
  status: BomStatus;
  confidence: BomConfidence;
  basis: string;
};

export type SystemDefinition = {
  name: SystemName;
  summary: string;
  manufacturers: string[];
  firstActions: string[];
  retrofitFocus: string[];
};

export const SYSTEMS: SystemDefinition[] = [
  {
    name: "Lighting",
    summary:
      "Architectural fixture layout, photometrics, loads, drivers, control zones, and coordination.",
    manufacturers: ["DMF Lighting", "QTL", "Lutron"],
    firstActions: [
      "Map existing and proposed fixture locations.",
      "Separate ambient, task, accent, decorative, and linear-lighting intent.",
      "Confirm ceiling conditions, CCT, CRI, beam angles, and dimming method.",
      "Create load groups before finalizing Lutron control hardware.",
    ],
    retrofitFocus: [
      "Identify fixtures/housings that can remain.",
      "Verify existing dimming compatibility and driver condition.",
      "Reuse branch wiring and ceiling openings only after field verification.",
      "Replace only the fixtures, drivers, or controls that block the target design.",
    ],
  },
  {
    name: "Lutron",
    summary:
      "HomeWorks control architecture, keypads, load control, processors, shades, HVAC integration, and scenes.",
    manufacturers: ["Lutron"],
    firstActions: [
      "Create a room-by-room load schedule.",
      "Classify each load: dimmed, switched, 0-10 V, phase control, driver, or specialty.",
      "Identify keypad/control-point locations and scene intent.",
      "Size processors, links, modules, panels, and power supplies from the approved load map.",
    ],
    retrofitFocus: [
      "Identify the existing Lutron/control platform and generation.",
      "Survey switch boxes, neutral availability, wiring topology, and load types.",
      "Reuse compatible fixtures, wiring, enclosures, and shades when practical.",
      "Flag incompatible legacy controls/modules for replacement instead of assuming a full rip-and-replace.",
    ],
  },
  {
    name: "QTL",
    summary:
      "Linear-lighting runs, profiles, output, CCT, lenses, feeds, drivers, wattage, and quote preparation.",
    manufacturers: ["QTL"],
    firstActions: [
      "Trace each intended linear-lighting run on the drawing.",
      "Measure run length and define application: cove, millwork, shelf, toe-kick, or architectural.",
      "Select profile/output/CCT/lens and determine feed direction.",
      "Calculate driver load and coordinate an accessible driver location.",
    ],
    retrofitFocus: [
      "Survey existing coves, channels, millwork clearances, and driver locations.",
      "Reuse accessible power feeds where voltage/control compatibility is confirmed.",
      "Replace failed or incompatible tape, extrusion, or drivers without disturbing usable millwork when possible.",
    ],
  },
  {
    name: "Shades",
    summary:
      "Shade openings, pockets, fabrics, operators, power/control, drapery, and architectural coordination.",
    manufacturers: ["Lutron"],
    firstActions: [
      "Map every opening requiring solar, privacy, or blackout treatment.",
      "Capture opening dimensions and pocket/headbox constraints.",
      "Define fabric, operator, mounting, and control requirements.",
      "Coordinate shade power and HomeWorks integration.",
    ],
    retrofitFocus: [
      "Measure existing pockets and confirm usable clearances.",
      "Inspect existing shade power and communication wiring.",
      "Reuse compatible pockets/tracks and replace only motors/fabric/control where practical.",
    ],
  },
  {
    name: "Network",
    summary:
      "UniFi-first gateway, switching, PoE, AP placement, VLANs, drops, rack, and network validation.",
    manufacturers: ["Ubiquiti / UniFi"],
    firstActions: [
      "Identify internet handoff and equipment/rack location.",
      "Map AP candidate locations from room geometry and construction.",
      "Count wired endpoints, cameras, AV devices, and PoE loads.",
      "Size gateway, switching, uplinks, PoE budget, and reserve capacity.",
    ],
    retrofitFocus: [
      "Test existing CAT cable before assuming new pulls.",
      "Reuse viable rack, pathways, and drops; replace bottlenecks selectively.",
      "Survey existing Wi-Fi coverage and interference before moving APs.",
      "Preserve working endpoints while migrating gateway/switching in controlled stages.",
    ],
  },
  {
    name: "Audio",
    summary:
      "Passive soundbars, in-wall/in-ceiling/invisible speakers, subwoofers, amplification, and listening zones.",
    manufacturers: ["Leon Speakers", "Sonance", "James by Sonance"],
    firstActions: [
      "Define listening zones and room-use goals.",
      "Choose visible, small-aperture, invisible, or custom-width solutions from aesthetic requirements.",
      "Confirm mounting depth, backbox, dispersion, impedance, and amplifier needs.",
      "Coordinate speaker wire, subwoofer pathways, and finish requirements.",
    ],
    retrofitFocus: [
      "Reuse speaker wire and backboxes only after continuity/condition checks.",
      "Keep existing speakers that meet coverage, performance, and aesthetic goals.",
      "Upgrade amplification or endpoints independently where the existing infrastructure supports it.",
    ],
  },
  {
    name: "Video",
    summary:
      "Displays, passive/custom soundbars, mounts, recessed boxes, blocking, power, data, and elevations.",
    manufacturers: ["Leon Speakers", "Future Automation", "Sony / display vendor"],
    firstActions: [
      "Identify intended display walls and viewing positions.",
      "Set display size, centerline/AFF, mount, blocking, and backbox requirements.",
      "Coordinate soundbar width/height with the final display and millwork.",
      "Confirm power, data, control, ventilation, and service access.",
    ],
    retrofitFocus: [
      "Verify existing mount/backbox compatibility with the new display.",
      "Reuse blocking, power, and data where location and capacity remain suitable.",
      "Replace only incompatible mounting hardware or recessed boxes.",
    ],
  },
  {
    name: "Infrastructure",
    summary:
      "Rack, pathways, cable types, power, UPS, backboxes, conduit, and cross-system coordination.",
    manufacturers: ["Future Automation", "Ubiquiti / UniFi", "Project-specific"],
    firstActions: [
      "Confirm rack/equipment locations and service clearance.",
      "Map cable pathways, sleeves, conduit, and required backboxes.",
      "Coordinate dedicated power, UPS/power management, and ventilation.",
      "Track responsibilities between integrator, EC, GC, architect, and millwork.",
    ],
    retrofitFocus: [
      "Survey existing rack space, power, grounding, ventilation, and pathways.",
      "Reuse pathways/backboxes that meet the new design requirements.",
      "Add infrastructure only where the existing installation creates capacity, serviceability, or code/coordination problems.",
    ],
  },
];

type LayerCount = { count: number; basis: "symbols" | "entities" };

/**
 * Counts items on layers whose names contain any token. Prefers block
 * references (one per symbol); falls back to raw entities, which count every
 * line/arc a symbol is drawn with and so overstate quantities.
 */
function countLayerMatches(
  analysis: DrawingAnalysis | null,
  tokens: string[],
): LayerCount {
  if (!analysis) return { count: 0, basis: "entities" };

  const matching = analysis.layers.filter((layer) => {
    const name = layer.name.toLowerCase();
    return tokens.some((token) => name.includes(token));
  });
  const symbols = matching.reduce((sum, layer) => sum + (layer.insertCount ?? 0), 0);
  if (symbols > 0) return { count: symbols, basis: "symbols" };
  return {
    count: matching.reduce((sum, layer) => sum + layer.entityCount, 0),
    basis: "entities",
  };
}

function drawingCount(found: LayerCount, noun: string) {
  if (found.count === 0) {
    return {
      quantity: "TBD",
      confidence: "Review" as const,
      basis: `No ${noun} layers were detected in the imported drawing; field survey required.`,
    };
  }
  return {
    quantity: String(found.count),
    confidence: found.basis === "symbols" ? ("Medium" as const) : ("Review" as const),
    basis:
      found.basis === "symbols"
        ? `${found.count} ${noun} symbols (block references) found on matching drawing layers.`
        : `${found.count} drawing entities on matching ${noun} layers; symbols drawn with several lines are counted more than once, so treat this as an upper bound.`,
  };
}

function countRooms(
  analysis: DrawingAnalysis | null,
  roomTypes: string[],
): number {
  if (!analysis) return 0;

  return analysis.potentialRooms.filter((room) =>
    roomTypes.includes(room.normalizedType),
  ).length;
}

export function getSystemDefinition(system: SystemName): SystemDefinition {
  return SYSTEMS.find((item) => item.name === system) ?? SYSTEMS[0];
}

export function generatePreliminaryBom(
  analysis: DrawingAnalysis | null,
  draft: DraftRecommendation[],
  mode: ProjectMode,
): BomItem[] {
  const items: BomItem[] = [];
  let sequence = 1;

  const add = (
    system: SystemName,
    manufacturer: string | undefined,
    item: string,
    quantity: string,
    status: BomStatus,
    confidence: BomConfidence,
    basis: string,
  ) => {
    items.push({
      id: `bom-${sequence++}`,
      system,
      manufacturer,
      item,
      quantity,
      status,
      confidence,
      basis,
    });
  };

  const roomCount = analysis?.potentialRooms.length ?? 0;
  const livingCount = countRooms(analysis, ["Living / Media"]);
  const bedroomCount = countRooms(analysis, ["Primary Bedroom", "Bedroom"]);
  const officeCount = countRooms(analysis, ["Office"]);

  // "fixt" alone would also match plumbing/architectural fixture layers (P-FIXT, A-FLOR-FIXT).
  const existingFixtures = countLayerMatches(analysis, ["e-lite", "e-fixt", "light"]);
  const existingSwitches = countLayerMatches(analysis, [
    "e-switch",
    "switch",
    "dimmer",
  ]);
  const existingPower = countLayerMatches(analysis, [
    "e-pow",
    "power",
    "recept",
    "outlet",
  ]);
  const existingData = countLayerMatches(analysis, [
    "data",
    "cat6",
    "network",
    "telecom",
    "comm",
  ]);

  if (mode === "retrofit") {
    const fixtures = drawingCount(existingFixtures, "lighting fixture");
    add(
      "Lighting",
      undefined,
      "Existing fixtures / housings to survey",
      fixtures.quantity,
      "Verify",
      fixtures.confidence,
      `${fixtures.basis} Field verify before reuse.`,
    );
    const switches = drawingCount(existingSwitches, "switch / dimmer");
    add(
      "Lutron",
      "Lutron",
      "Existing switches / dimmers / control stations to survey",
      switches.quantity,
      "Verify",
      switches.confidence,
      `${switches.basis} Retrofit path should reuse compatible boxes, wiring, and controls only after platform/load/wiring verification.`,
    );
    const power = drawingCount(existingPower, "power / receptacle");
    add(
      "Infrastructure",
      undefined,
      "Existing power locations to verify",
      power.quantity,
      "Reuse",
      power.confidence,
      `${power.basis} Existing power can reduce new rough-in where location, capacity, grounding, and code/coordination remain acceptable.`,
    );
    const data = drawingCount(existingData, "data / telecom");
    add(
      "Network",
      undefined,
      "Existing structured-cabling drops to test",
      data.quantity,
      "Reuse",
      data.confidence,
      `${data.basis} Test cable category, continuity, termination quality, and achievable link speed before reuse.`,
    );
  }

  add(
    "Lighting",
    "DMF Lighting",
    "Architectural downlights / fixtures",
    mode === "retrofit" && existingFixtures.count > 0 ? "TBD delta" : "TBD",
    mode === "retrofit" ? "Verify" : "Add",
    "Review",
    "Final quantity/model comes from the approved lighting layout, photometrics, ceiling conditions, and fixture schedule.",
  );
  add(
    "Lighting",
    undefined,
    "Drivers / transformers / specialty power",
    "TBD",
    mode === "retrofit" ? "Verify" : "Add",
    "Review",
    "Required where selected fixtures or linear lighting use remote drivers/transformers; size after load selection.",
  );

  add(
    "Lutron",
    "Lutron",
    "HomeWorks processor / control platform",
    "1 provisional",
    mode === "retrofit" ? "Verify" : "Add",
    "Medium",
    mode === "retrofit"
      ? "Confirm the existing Lutron/control generation first. Reuse a compatible platform or plan migration where legacy hardware cannot support the target design."
      : "One control platform is provisionally assumed; final processor/link count depends on system size and topology.",
  );
  add(
    "Lutron",
    "Lutron",
    "Keypads / control stations",
    roomCount > 0 ? `${Math.max(roomCount, 1)} est.` : "TBD",
    mode === "retrofit" ? "Verify" : "Add",
    "Medium",
    "Estimated from detected room labels only. Final count depends on entries, bedside/control locations, scene intent, and wall design.",
  );
  add(
    "Lutron",
    "Lutron",
    "Load-control modules / dimmers / switching interfaces",
    "TBD",
    mode === "retrofit" ? "Verify" : "Add",
    "Review",
    "Cannot be finalized until every lighting/load circuit is mapped by load type, wattage, dimming protocol, and location.",
  );
  add(
    "Lutron",
    "Lutron",
    "Power supplies / interfaces / gateways",
    "TBD",
    "Add",
    "Review",
    "Final accessories depend on keypad, shade, HVAC, integration, and link architecture.",
  );

  add(
    "QTL",
    "QTL",
    "Linear LED runs / assemblies",
    draft.some((item) => item.system === "QTL") ? "TBD by run" : "TBD",
    mode === "retrofit" ? "Verify" : "Add",
    "Review",
    "Each run requires measured geometry plus profile, output, CCT, lens, feed, environment, and mounting definition.",
  );
  add(
    "QTL",
    "QTL",
    "Drivers / power supplies",
    "TBD",
    mode === "retrofit" ? "Verify" : "Add",
    "Review",
    "Driver quantity/capacity follows actual run wattage and accessible driver-location strategy.",
  );

  add(
    "Shades",
    "Lutron",
    "Sivoia QS shades / drapery treatments",
    bedroomCount > 0 ? `${bedroomCount}+ openings to review` : "TBD",
    mode === "retrofit" ? "Verify" : "Add",
    "Review",
    "Do not use room count as final shade count. Measure every opening and coordinate pockets, fabric, operator, and blackout/solar intent.",
  );
  add(
    "Shades",
    "Lutron",
    "Shade power / control infrastructure",
    "TBD",
    mode === "retrofit" ? "Verify" : "Add",
    "Review",
    "Panel/power requirements follow the final shade schedule and existing wiring survey.",
  );

  const apEstimate = roomCount > 0 ? Math.max(1, Math.ceil(roomCount / 3)) : 1;
  add(
    "Network",
    "Ubiquiti / UniFi",
    "Wi-Fi access points",
    `${apEstimate} est.`,
    mode === "retrofit" ? "Verify" : "Add",
    "Medium",
    "Early candidate quantity derived only from detected room count. Final AP count/location requires geometry, wall-material assumptions, client density, and RF validation.",
  );
  add(
    "Network",
    "Ubiquiti / UniFi",
    "Cloud gateway / router",
    "1",
    mode === "retrofit" ? "Replace" : "Add",
    "Medium",
    "Model depends on WAN speed, IDS/IPS throughput, application needs, redundancy, and rack constraints.",
  );
  add(
    "Network",
    "Ubiquiti / UniFi",
    "PoE switching",
    "1+",
    mode === "retrofit" ? "Verify" : "Add",
    "Medium",
    "Port count and PoE budget must be calculated from APs, cameras, control devices, AV endpoints, and reserve capacity.",
  );
  add(
    "Network",
    undefined,
    "CAT6A / structured-cabling drops",
    officeCount > 0 ? "TBD + office/media drops" : "TBD",
    mode === "retrofit" ? "Verify" : "Add",
    "Review",
    "Reuse existing tested drops where suitable; add dedicated wired connectivity for APs, AV, offices, cameras, and control.",
  );

  add(
    "Audio",
    "Leon / Sonance / James",
    "Passive LCR / custom soundbar packages",
    livingCount > 0 ? String(livingCount) : "TBD",
    mode === "retrofit" ? "Verify" : "Add",
    "Medium",
    "Candidate quantity follows detected living/media spaces. Final manufacturer/model depends on display width, aesthetics, room performance target, and budget.",
  );
  add(
    "Audio",
    "Sonance / James by Sonance",
    "Architectural in-wall / in-ceiling / invisible speakers",
    "TBD",
    mode === "retrofit" ? "Verify" : "Add",
    "Review",
    "Quantity and family require listening-zone geometry, ceiling height, finish constraints, dispersion, and room-use requirements.",
  );
  add(
    "Audio",
    undefined,
    "Amplification / DSP",
    "TBD",
    mode === "retrofit" ? "Verify" : "Add",
    "Review",
    "Size after final speaker impedance, channel count, power requirements, and zoning are known.",
  );

  add(
    "Video",
    undefined,
    "Displays",
    livingCount > 0 ? `${livingCount} primary candidate` : "TBD",
    mode === "retrofit" ? "Verify" : "Add",
    "Review",
    "Detected room labels identify possible primary display zones; final display schedule requires client requirements and elevations.",
  );
  add(
    "Video",
    "Future Automation",
    "Mounts / recessed wall boxes",
    livingCount > 0 ? `${livingCount} candidate set` : "TBD",
    mode === "retrofit" ? "Verify" : "Add",
    "Review",
    "Mount/backbox compatibility follows the final display size, VESA, load, swivel/extension needs, wall construction, and soundbar/elevation design.",
  );

  add(
    "Infrastructure",
    undefined,
    "AV / network rack or equipment enclosure",
    "1 provisional",
    mode === "retrofit" ? "Verify" : "Add",
    "Medium",
    "Reuse existing rack only if RU, depth, ventilation, power, service access, and cable management meet the upgraded design.",
  );
  add(
    "Infrastructure",
    undefined,
    "UPS / power management",
    "1+",
    mode === "retrofit" ? "Verify" : "Add",
    "Medium",
    "Final capacity depends on rack loads and runtime requirements.",
  );
  add(
    "Infrastructure",
    undefined,
    "Backboxes / blocking / conduit / pathways",
    "TBD",
    mode === "retrofit" ? "Verify" : "Add",
    "Review",
    "Coordinate only where existing construction cannot support the approved devices, service access, or cable pathways.",
  );

  return items;
}


export type ExistingControlPlatform =
  | "Unknown"
  | "None"
  | "RadioRA 2"
  | "RadioRA 3"
  | "HomeWorks QS"
  | "HomeWorks QSX"
  | "Other";

export type ExistingNetworkPlatform =
  | "Unknown"
  | "None"
  | "UniFi"
  | "Araknis"
  | "Ruckus"
  | "Eero"
  | "Other";

export type ExistingAudioPlatform =
  | "Unknown"
  | "None"
  | "Sonance / James"
  | "Leon"
  | "Mixed"
  | "Other";

export type RetrofitSurvey = {
  controlPlatform: ExistingControlPlatform;
  networkPlatform: ExistingNetworkPlatform;
  audioPlatform: ExistingAudioPlatform;
  speakerCount: number;
  catDrops: number;
  displayCount: number;
  shadeCount: number;
  hasRack: boolean;
  preserveSpeakers: boolean;
  preserveCabling: boolean;
  preserveRack: boolean;
  targetHomeWorks: boolean;
  targetUnifi: boolean;
  notes: string;
};

export const DEFAULT_RETROFIT_SURVEY: RetrofitSurvey = {
  controlPlatform: "Unknown",
  networkPlatform: "Unknown",
  audioPlatform: "Unknown",
  speakerCount: 0,
  catDrops: 0,
  displayCount: 0,
  shadeCount: 0,
  hasRack: false,
  preserveSpeakers: true,
  preserveCabling: true,
  preserveRack: true,
  targetHomeWorks: true,
  targetUnifi: true,
  notes: "",
};

/** Saved survey with missing or wrong-typed fields reset to defaults (see sanitize.ts). */
export function normalizeSurvey(value: unknown, repairs?: string[]): RetrofitSurvey {
  return withDefaults(value, DEFAULT_RETROFIT_SURVEY, "survey", repairs);
}

export function applyRetrofitSurvey(
  sourceBom: BomItem[],
  survey: RetrofitSurvey,
): BomItem[] {
  return sourceBom.map((item) => {
    const next = { ...item };

    if (item.system === "Lutron" && item.item.includes("HomeWorks processor")) {
      if (!survey.targetHomeWorks) {
        next.status = "Verify";
        next.confidence = "Review";
        next.basis =
          "HomeWorks is not selected as the retrofit target. Confirm the intended control platform before defining processor hardware.";
      } else if (survey.controlPlatform === "HomeWorks QSX") {
        next.status = "Reuse";
        next.confidence = "High";
        next.quantity = "1 existing";
        next.basis =
          "Existing HomeWorks QSX was entered in the retrofit survey. Keep the processor provisionally, then verify links, capacity, firmware, and project access before release.";
      } else if (
        survey.controlPlatform === "HomeWorks QS" ||
        survey.controlPlatform === "RadioRA 2" ||
        survey.controlPlatform === "RadioRA 3" ||
        survey.controlPlatform === "Other"
      ) {
        next.status = "Replace";
        next.confidence = "Medium";
        next.basis =
          `Retrofit survey lists ${survey.controlPlatform} while the target is HomeWorks. Treat processor/control-platform replacement as provisional until migration compatibility and retained devices are verified.`;
      } else if (survey.controlPlatform === "None") {
        next.status = "Add";
        next.confidence = "High";
        next.basis =
          "No existing lighting-control platform was entered and HomeWorks is the target system.";
      }
    }

    if (item.system === "Network" && item.item.includes("Cloud gateway")) {
      if (!survey.targetUnifi) {
        next.status = "Verify";
        next.confidence = "Review";
        next.basis =
          "UniFi is not selected as the retrofit target. Confirm the desired network platform before choosing a gateway.";
      } else if (survey.networkPlatform === "UniFi") {
        next.status = "Reuse";
        next.confidence = "Medium";
        next.quantity = "1 existing";
        next.basis =
          "Existing UniFi was entered in the retrofit survey. Reuse is provisional until gateway model, throughput, controller ownership, firmware, and security requirements are checked.";
      } else if (
        survey.networkPlatform !== "Unknown" &&
        survey.networkPlatform !== "None"
      ) {
        next.status = "Replace";
        next.confidence = "Medium";
        next.basis =
          `Existing network platform is ${survey.networkPlatform}; target is UniFi. Plan a staged gateway migration while preserving working endpoints where practical.`;
      } else if (survey.networkPlatform === "None") {
        next.status = "Add";
        next.confidence = "High";
        next.basis =
          "No existing network platform was entered and UniFi is the target.";
      }
    }

    if (item.system === "Network" && item.item.includes("PoE switching")) {
      if (survey.targetUnifi && survey.networkPlatform === "UniFi") {
        next.status = "Verify";
        next.confidence = "Medium";
        next.basis =
          "Existing UniFi may already include usable switching. Verify model, port speed, PoE standards, PoE budget, uplinks, and reserve capacity before adding or replacing switches.";
      }
    }

    if (
      item.system === "Network" &&
      item.item.includes("structured-cabling drops") &&
      survey.preserveCabling &&
      survey.catDrops > 0
    ) {
      next.status = "Reuse";
      next.confidence = "Medium";
      next.quantity = `${survey.catDrops} existing + TBD new`;
      next.basis =
        "Existing structured-cabling drops were entered in the survey. Reuse only after continuity, category, termination, link-speed, and pathway checks.";
    }

    if (
      item.system === "Audio" &&
      item.item.includes("Architectural in-wall") &&
      survey.preserveSpeakers &&
      survey.speakerCount > 0
    ) {
      next.status = "Reuse";
      next.confidence = "Medium";
      next.quantity = `${survey.speakerCount} existing`;
      next.manufacturer =
        survey.audioPlatform === "Unknown" || survey.audioPlatform === "None"
          ? item.manufacturer
          : survey.audioPlatform;
      next.basis =
        "Existing architectural speakers were entered in the retrofit survey and marked for preservation. Verify model, impedance, condition, backbox, placement, coverage, wiring, and finish before reuse.";
    }

    if (
      item.system === "Infrastructure" &&
      item.item.includes("rack or equipment enclosure") &&
      survey.hasRack &&
      survey.preserveRack
    ) {
      next.status = "Reuse";
      next.confidence = "Medium";
      next.quantity = "1 existing";
      next.basis =
        "Existing rack was entered and marked for preservation. Verify RU, usable depth, ventilation, power, grounding, service clearance, and cable management.";
    }

    if (
      item.system === "Video" &&
      item.item === "Displays" &&
      survey.displayCount > 0
    ) {
      next.status = "Verify";
      next.confidence = "Medium";
      next.quantity = `${survey.displayCount} existing`;
      next.basis =
        "Existing displays were entered in the retrofit survey. Keep or replace room-by-room based on size, age, control capability, mounting compatibility, client goals, and image-performance requirements.";
    }

    if (
      item.system === "Shades" &&
      item.item.includes("Sivoia QS") &&
      survey.shadeCount > 0
    ) {
      next.status = "Verify";
      next.confidence = "Medium";
      next.quantity = `${survey.shadeCount} existing/openings`;
      next.basis =
        "Existing shade count/openings were entered in the retrofit survey. Verify operator family, wiring, pocket dimensions, fabric condition, controls, and compatibility before deciding what remains.";
    }

    return next;
  });
}
