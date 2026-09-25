export type QtlProductCategory =
  | "Rigid Fixture"
  | "Flexible Fixture"
  | "Profile / Extrusion"
  | "LED Strip"
  | "Cove System"
  | "Closet System";

export type QtlFixtureProduct = {
  id: string;
  family: string;
  name: string;
  category: QtlProductCategory;
  applications: string[];
  environments: Array<"Dry" | "Damp" | "Wet" | "Submersible">;
  lightEngines: string[];
  wattagesPerFt?: number[];
  ccts?: string[];
  lenses?: string[];
  mounting?: string[];
  minLengthIn?: number;
  maxLengthIn?: number;
  bendRadiusIn?: number;
  notes: string;
  officialUrl: string;
};

export type QtlPowerSupplyFamily = {
  id: string;
  name: string;
  currentUse: string;
  acDc: "AC" | "DC";
  outputVoltages: string[];
  wattages: number[];
  controls: string[];
  environments: string[];
  mounting: string[];
  notes: string;
  officialUrl: string;
};

export type QtlPreset = {
  id: string;
  label: string;
  application: string;
  productId: string;
  wattsPerFt: number;
  cct: string;
  environment: "Dry" | "Damp" | "Wet";
  lens: string;
  dimming: string;
  powerSupplyFamilyId: string;
  note: string;
  derivedFromQuoteExample?: boolean;
};

/**
 * Review state of this catalog. It predates the source-backed product library
 * (data/library/) and has not been verified there yet, so sizing results built
 * on it must say so. Remove once the QTL data moves into the library.
 */
export const QTL_CATALOG_REVIEW_NOTE =
  "QTL capacities and options come from the seeded QTL catalog, which has not yet been source-verified in the product library.";

export const QTL_FAMILY_OVERVIEW = [
  {
    family: "MICRO 5",
    summary: "Ultra-compact rigid/flexible family for tight architectural details.",
    members: ["ALTA", "ATOM", "KICKER", "POP", "SLITE", "TILT"],
  },
  {
    family: "Q-CAP",
    summary: "Flexible encapsulated architectural fixtures for curved and complex geometry.",
    members: ["KURV", "BOXA", "ANYBEND", "WALA", "ZALA", "WAVE", "WURM", "KURV-BK", "LUME", "NEXUS"],
  },
  {
    family: "VERS",
    summary: "Versatile high-performance rigid and suspended architectural family.",
    members: ["PROUD", "FLUSH", "CLEAR", "GRAZER", "OPTICS", "ENCAPSULATED", "SUSPENDED"],
  },
  {
    family: "ESSENTIALS / Profiles",
    summary: "Broad profile/extrusion family for surface, recessed, millwork and specialty details.",
    members: ["ARKA", "EMBD", "FLUR", "LALO", "LATO", "MDIN", "OPTI", "TALO", "TELA", "THIN", "TORQ", "TRE3", "VEVE", "WIDE"],
  },
  {
    family: "QUOVA",
    summary: "Pre-made knife-edge cove system for fast architectural cove construction.",
    members: ["QUOVA STANDARD", "QUOVA MICRO"],
  },
  {
    family: "POSH",
    summary: "Specification-grade illuminated closet rod family.",
    members: ["POSH FLOAT", "POSH WALL TO WALL"],
  },
];

export const QTL_FIXTURES: QtlFixtureProduct[] = [
  {
    id: "qcap-kurv",
    family: "Q-CAP",
    name: "Q-CAP KURV",
    category: "Flexible Fixture",
    applications: ["Cove", "Perimeter", "Curved Cove", "Feature"],
    environments: ["Dry", "Wet", "Submersible"],
    lightEngines: ["Static White", "Static White HE", "Tunable White", "Warm Dim", "RGB", "RGBW", "Static Color"],
    wattagesPerFt: [1.5, 3, 5, 1.5, 3, 6],
    ccts: ["2200K", "2400K", "2700K", "3000K", "3500K", "4000K"],
    lenses: ["Encapsulated Clear", "Encapsulated Translucent"],
    mounting: ["Snug Clip", "Rigid Lock Channel", "Magnetic Clip", "Side Graze Channel", "PVC Clip / Channel", "BENDIT Channel"],
    minLengthIn: 12,
    maxLengthIn: 191,
    bendRadiusIn: 6,
    notes: "Side-bending encapsulated fixture. Useful where the light path curves in plan.",
    officialUrl: "https://www.qtl.lighting/products/kurv/",
  },
  {
    id: "qcap-boxa",
    family: "Q-CAP",
    name: "Q-CAP BOXA",
    category: "Flexible Fixture",
    applications: ["Cove", "Perimeter", "Feature", "Curved Detail"],
    environments: ["Dry", "Wet"],
    lightEngines: ["Static White", "Static White HE", "Tunable White", "Warm Dim", "RGB", "RGBW"],
    notes: "Flexible encapsulated fixture with up/down bending capability; exact current ordering options should be verified from the official product page.",
    officialUrl: "https://www.qtl.lighting/products/q-cap-flexible-led-fixtures/",
  },
  {
    id: "micro5-tilt-flat",
    family: "MICRO 5",
    name: "MICRO 5 TILT-FLAT (01)",
    category: "Rigid Fixture",
    applications: ["Under Cabinet", "Shelf", "Corner", "Millwork", "Vanity"],
    environments: ["Dry", "Damp"],
    lightEngines: ["Static White", "Tunable White", "RGB"],
    wattagesPerFt: [1, 2, 4],
    lenses: ["Flat / Diffused"],
    mounting: ["Corner", "Surface"],
    notes: "45-degree corner/surface fixture; particularly useful for under-cabinet and shelf details.",
    officialUrl: "https://www.qtl.lighting/products/tilt-flat-01/",
  },
  {
    id: "essentials-thin-flat",
    family: "ESSENTIALS",
    name: "ESSENTIALS THIN-FLAT (01)",
    category: "Rigid Fixture",
    applications: ["Vanity", "Millwork", "Surface", "Closet", "Shelf"],
    environments: ["Dry", "Damp", "Wet"],
    lightEngines: ["Static White", "Static White HE", "SCOB Static White", "Tunable White", "Warm Dim", "RGB", "RGBW", "Static Color"],
    wattagesPerFt: [1.5, 3, 4, 5, 6],
    lenses: ["Clear", "Diffused", "Polar", "Frosted"],
    mounting: ["Stainless Steel Clip", "Magnet", "Low-Profile Magnet"],
    notes: "Ultra-thin surface fixture for constrained details.",
    officialUrl: "https://www.qtl.lighting/products/led-lighting-thin-flat-01/",
  },
  {
    id: "vers-flush-02",
    family: "VERS",
    name: "VERS-FLUSH (02)",
    category: "Rigid Fixture",
    applications: ["Surface", "Cove", "Perimeter", "Work Surface", "Suspended system variant"],
    environments: ["Dry", "Damp"],
    lightEngines: ["Static White", "Static White HE", "Tunable White", "Warm Dim", "RGB", "Static Color"],
    wattagesPerFt: [1.5, 3, 4, 5, 6, 9],
    ccts: ["1800K", "2000K", "2200K", "2400K", "2700K", "3000K", "3500K", "4000K"],
    lenses: ["Diffused", "Polar"],
    mounting: ["Concealed Clip", "Magnet"],
    minLengthIn: 12,
    maxLengthIn: 98,
    notes: "Flush co-extruded lens with internal reflector. High-output options make it useful for task/work surfaces.",
    officialUrl: "https://www.qtl.lighting/products/vers-flush-02/",
  },
  {
    id: "tre3-profile",
    family: "Profile / Extrusion",
    name: "TRE3 Extrusion",
    category: "Profile / Extrusion",
    applications: ["Sauna / Specialty", "Millwork", "Feature"],
    environments: ["Dry", "Damp"],
    lightEngines: ["Paired LED Strip"],
    lenses: ["Diffused"],
    notes: "Three-sided lens extrusion. Pair with a compatible LED strip/light engine; environment depends on the complete assembly.",
    officialUrl: "https://www.qtl.lighting/products/vers-linear-led-fixtures/",
  },
  {
    id: "wide-profile",
    family: "Profile / Extrusion",
    name: "WIDE Extrusion",
    category: "Profile / Extrusion",
    applications: ["Millwork", "Shelf", "Bench", "Surface"],
    environments: ["Dry", "Damp"],
    lightEngines: ["Paired LED Strip"],
    lenses: ["Diffused"],
    notes: "Wide aluminum profile used with compatible strip/light engine.",
    officialUrl: "https://www.qtl.lighting/products/linear-surface/",
  },
  {
    id: "xt24-strip",
    family: "LED Strip",
    name: "Static White XT 24V Strip",
    category: "LED Strip",
    applications: ["Profile / Extrusion", "Wet Detail", "Sauna / Specialty", "Millwork"],
    environments: ["Dry", "Wet"],
    lightEngines: ["Static White"],
    wattagesPerFt: [3],
    notes: "Quote example used SW-XT24/3.0 in wet-rated profile assemblies. Exact current strip options should be verified against the official strip catalog.",
    officialUrl: "https://www.qtl.lighting/products/led-light-strips/",
  },
  {
    id: "micro5-alta-flat",
    family: "MICRO 5",
    name: "MICRO 5 ALTA-FLAT (01)",
    category: "Rigid Fixture",
    applications: ["Millwork", "Surface", "Recessed"],
    environments: ["Dry", "Damp", "Wet"],
    lightEngines: ["Static White", "Warm Dim", "Tunable White", "RGB"],
    ccts: ["1800K", "2000K", "2200K", "2400K", "2700K", "3000K", "3500K", "4000K"],
    lenses: ["Diffused", "Frosted", "Optical", "Grazer", "Encapsulated"],
    mounting: ["Surface", "Recessed", "Magnetic"],
    notes: "Compact low-profile family for tight details.",
    officialUrl: "https://www.qtl.lighting/products/alta-micro-linear-fixtures/",
  },
  {
    id: "quova-micro",
    family: "QUOVA",
    name: "QUOVA MICRO",
    category: "Cove System",
    applications: ["Knife-Edge Cove", "Ceiling Cove"],
    environments: ["Dry", "Damp"],
    lightEngines: ["Compatible MICRO 5 / strip engine"],
    notes: "Pre-made knife-edge cove housing intended to hide the light engine and simplify cove construction.",
    officialUrl: "https://www.qtl.lighting/products/led-lighting-quova-micro/",
  },
  {
    id: "posh-wall-to-wall",
    family: "POSH",
    name: "POSH WALL TO WALL",
    category: "Closet System",
    applications: ["Closet Rod", "Wardrobe"],
    environments: ["Dry"],
    lightEngines: ["Static White", "Static White HE"],
    wattagesPerFt: [1.5, 3, 4],
    ccts: ["1800K", "2000K", "2200K", "2400K", "2700K", "3000K", "3500K", "4000K"],
    lenses: ["Diffused"],
    notes: "Illuminated closet rod system; useful when closet lighting and hanging rail are integrated.",
    officialUrl: "https://www.qtl.lighting/products/posh-wall-to-wall/",
  },
];

export const QTL_POWER_SUPPLIES: QtlPowerSupplyFamily[] = [
  {
    id: "qz",
    name: "QZ",
    currentUse: "Compact / cost-effective 24VDC driver family; closest match to the QZ-30/60/96/192 devices in the sample quote.",
    acDc: "DC",
    outputVoltages: ["24VDC"],
    wattages: [30, 60, 96, 192, 288],
    controls: ["Phase", "0-10V", "DMX", "DALI", "Non-dimming", "Warm Dim variants"],
    environments: ["Indoor Dry/Damp", "Some wet/outdoor variants"],
    mounting: ["Surface / Wall"],
    notes: "Use exact model/protocol variant after fixture/control selection. Do not select by wattage alone.",
    officialUrl: "https://www.qtl.lighting/products/qz-indoor-dc-led-power-supplies/",
  },
  {
    id: "qtm",
    name: "QTM",
    currentUse: "Indoor DC power-supply center for larger/multi-load architectural systems.",
    acDc: "DC",
    outputVoltages: ["12VDC", "24VDC"],
    wattages: [60, 100, 120, 180, 200, 300, 400, 500],
    controls: ["0-10V", "Tunable White", "Warm Dim", "Lutron Athena Wireless variants"],
    environments: ["Indoor Dry/Damp", "Selected wet variants"],
    mounting: ["Surface", "Recessed", "Wall", "Suspended", "Above Ceiling"],
    notes: "Useful when higher capacity, grouped loads or Athena-node options are needed.",
    officialUrl: "https://www.qtl.lighting/products/qtm-0-10v-dimming-led-power-supplies/",
  },
  {
    id: "qom",
    name: "QOM",
    currentUse: "Weather-resistant outdoor DC power supply family.",
    acDc: "DC",
    outputVoltages: ["12VDC", "24VDC"],
    wattages: [60, 100, 120, 180, 200, 300, 400],
    controls: ["0-10V", "Warm Dim", "Tunable White", "Non-dimming"],
    environments: ["Indoor", "Outdoor Wet", "Pool / Spa variants"],
    mounting: ["Surface"],
    notes: "Consider for outdoor/wet DC systems where an indoor-only power supply is not appropriate.",
    officialUrl: "https://www.qtl.lighting/products/qom-0-10v-dimming-led-power-supplies/",
  },
  {
    id: "qhex",
    name: "Q-HEX",
    currentUse: "AC direct-burial transformer family.",
    acDc: "AC",
    outputVoltages: ["12VAC", "24VAC"],
    wattages: [10, 20, 50, 60, 75, 120, 180, 240, 300],
    controls: ["Phase"],
    environments: ["Outdoor Wet", "Landscape", "Direct Burial"],
    mounting: ["Direct Burial"],
    notes: "Q-HEX MINI covers compact 10-75W applications; larger Q-HEX variants extend higher.",
    officialUrl: "https://www.qtl.lighting/products/q-hex-ac-direct-burial-led-power-supplies/",
  },
  {
    id: "qset-dc",
    name: "Q-SET DC / Q-VAULT",
    currentUse: "Direct-burial / outdoor DC system housed in Q-VAULT-5.",
    acDc: "DC",
    outputVoltages: ["12VDC", "24VDC"],
    wattages: [30, 60, 96, 100, 120, 180, 200, 240, 300],
    controls: ["0-10V", "Non-dimming", "Electronic variants"],
    environments: ["Outdoor Wet", "Landscape", "Pool / Spa", "Direct Burial"],
    mounting: ["Q-VAULT-5 Direct Burial"],
    notes: "Use where the driver itself must be coordinated as part of a direct-burial system.",
    officialUrl: "https://www.qtl.lighting/products/q-set-direct-burial-dc-led-power-supplies/",
  },
  {
    id: "qset-ac",
    name: "Q-SET AC / Q-VAULT",
    currentUse: "Heavy-duty AC direct-burial transformer system.",
    acDc: "AC",
    outputVoltages: ["12VAC", "24VAC"],
    wattages: [60, 120, 180, 240, 300, 360, 480, 540, 600, 720, 900],
    controls: ["Phase"],
    environments: ["Landscape", "Pool / Spa", "Direct Burial"],
    mounting: ["Q-VAULT-5 Direct Burial"],
    notes: "Q-SET-1/2/3 cover progressively larger AC transformer capacities.",
    officialUrl: "https://www.qtl.lighting/products/q-set-ac-direct-burial-led-power-supplies/",
  },
];

export const QTL_PRESETS: QtlPreset[] = [
  {
    id: "preset-curved-cove",
    label: "Curved Cove — KURV",
    application: "Cove",
    productId: "qcap-kurv",
    wattsPerFt: 6,
    cct: "3000K",
    environment: "Dry",
    lens: "Encapsulated Translucent",
    dimming: "0-10V / Phase capable QZ variant",
    powerSupplyFamilyId: "qz",
    note: "Based on a recurring KURV + QZ pattern in the supplied project quote.",
    derivedFromQuoteExample: true,
  },
  {
    id: "preset-under-cabinet",
    label: "Under Cabinet — TILT-FLAT",
    application: "Under Cabinet",
    productId: "micro5-tilt-flat",
    wattsPerFt: 4,
    cct: "3000K",
    environment: "Dry",
    lens: "Diffused",
    dimming: "0-10V / Phase capable QZ variant",
    powerSupplyFamilyId: "qz",
    note: "Matches the TILT-FLAT 4.0W/ft + QZ pattern used repeatedly in the supplied quote.",
    derivedFromQuoteExample: true,
  },
  {
    id: "preset-vanity",
    label: "Vanity — THIN-FLAT",
    application: "Vanity",
    productId: "essentials-thin-flat",
    wattsPerFt: 5,
    cct: "3000K",
    environment: "Dry",
    lens: "Diffused",
    dimming: "0-10V / Phase capable QZ variant",
    powerSupplyFamilyId: "qz",
    note: "Matches the THIN-FLAT 5.0W/ft vanity pattern in the supplied quote.",
    derivedFromQuoteExample: true,
  },
  {
    id: "preset-wet-kurv",
    label: "Wet / Shower — KURV",
    application: "Wet Detail",
    productId: "qcap-kurv",
    wattsPerFt: 6,
    cct: "3000K",
    environment: "Wet",
    lens: "Encapsulated Translucent",
    dimming: "0-10V / Phase capable QZ variant",
    powerSupplyFamilyId: "qz",
    note: "Quote example paired wet KURV fixtures with QZ power supplies. Exact wet-location PSU placement still requires current installation rules.",
    derivedFromQuoteExample: true,
  },
  {
    id: "preset-sauna",
    label: "Sauna / Specialty — Profile + XT Strip",
    application: "Sauna / Specialty",
    productId: "xt24-strip",
    wattsPerFt: 3,
    cct: "3000K",
    environment: "Wet",
    lens: "Profile dependent",
    dimming: "QZ variant",
    powerSupplyFamilyId: "qz",
    note: "Quote used wet SW-XT24/3.0 strip with TRE3/WIDE extrusions and QZ-30 supplies.",
    derivedFromQuoteExample: true,
  },
  {
    id: "preset-work-surface",
    label: "Work Surface — VERS-FLUSH",
    application: "Work Surface",
    productId: "vers-flush-02",
    wattsPerFt: 9,
    cct: "3000K",
    environment: "Dry",
    lens: "Diffused",
    dimming: "0-10V / Phase capable QZ variant",
    powerSupplyFamilyId: "qz",
    note: "Quote example used VERS-FLUSH high-efficacy 9.0W/ft with QZ-96 supplies.",
    derivedFromQuoteExample: true,
  },
];

export function qtlFixtureById(id: string) {
  return QTL_FIXTURES.find((product) => product.id === id);
}

export function qtlPowerSupplyById(id: string) {
  return QTL_POWER_SUPPLIES.find((product) => product.id === id);
}

export const QTL_MAX_RESERVE_PCT = 80;

export function clampReservePct(reservePct: number) {
  if (!Number.isFinite(reservePct)) return 0;
  return Math.min(Math.max(reservePct, 0), QTL_MAX_RESERVE_PCT);
}

/**
 * Smallest capacity in the family that carries `loadWatts` while keeping
 * `reservePct` of its rating unused (e.g. 20% reserve = load at <= 80%).
 */
export function qtlCandidatePowerSupply(
  familyId: string,
  loadWatts: number,
  reservePct = 0,
) {
  const family = qtlPowerSupplyById(familyId);
  if (!family || loadWatts <= 0) return null;
  const maxLoadFraction = 1 - clampReservePct(reservePct) / 100;
  const wattage =
    [...family.wattages]
      .sort((a, b) => a - b)
      .find((value) => loadWatts <= value * maxLoadFraction + 1e-9) ?? null;
  return { family, wattage };
}
