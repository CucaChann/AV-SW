import DxfParser from "dxf-parser";

export type Point2D = { x: number; y: number };

export type DxfBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
};

export type DxfPrimitive =
  | { kind: "line"; layer: string; start: Point2D; end: Point2D }
  | { kind: "polyline"; layer: string; points: Point2D[]; closed: boolean }
  | { kind: "circle"; layer: string; center: Point2D; radius: number }
  | { kind: "arc"; layer: string; center: Point2D; radius: number; startAngle: number; endAngle: number }
  | { kind: "text"; layer: string; position: Point2D; text: string; height?: number }
  | { kind: "insert"; layer: string; position: Point2D; name: string };

export type RoomCandidate = {
  label: string;
  normalizedType: string;
  position: Point2D;
  layer: string;
};

export type DrawingAnalysis = {
  sourceType: "DXF";
  units: string;
  bounds: DxfBounds;
  entityCount: number;
  lineCount: number;
  polylineCount: number;
  circleCount: number;
  arcCount: number;
  textCount: number;
  dimensionCount: number;
  insertCount: number;
  layerCount: number;
  layers: Array<{ name: string; entityCount: number }>;
  potentialRooms: RoomCandidate[];
  wallLikeEntities: number;
  doorLikeEntities: number;
  windowLikeEntities: number;
};

export type DraftRecommendation = {
  id: string;
  system: "Lighting" | "Lutron" | "QTL" | "Shades" | "Network" | "Audio" | "Video" | "Infrastructure";
  room?: string;
  title: string;
  rationale: string;
  confidence: "High" | "Medium" | "Review";
};

export type ParsedDxfDrawing = {
  primitives: DxfPrimitive[];
  analysis: DrawingAnalysis;
  recommendations: DraftRecommendation[];
};

const UNIT_CODES: Record<number, string> = {
  0: "Unitless",
  1: "Inches",
  2: "Feet",
  3: "Miles",
  4: "Millimeters",
  5: "Centimeters",
  6: "Meters",
  7: "Kilometers",
  8: "Microinches",
  9: "Mils",
  10: "Yards",
  11: "Angstroms",
  12: "Nanometers",
  13: "Microns",
  14: "Decimeters",
  15: "Decameters",
  16: "Hectometers",
  17: "Gigameters",
  18: "Astronomical units",
  19: "Light years",
  20: "Parsecs",
};

function finitePoint(value: unknown): Point2D | null {
  if (!value || typeof value !== "object") return null;
  const point = value as Record<string, unknown>;
  const x = Number(point.x);
  const y = Number(point.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

function cleanText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/\\P/g, " ")
    .replace(/\\[A-Za-z][^;]*;/g, "")
    .replace(/[{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeRoomType(label: string): string | null {
  const value = label.toLowerCase();

  const patterns: Array<[RegExp, string]> = [
    [/great room|family room|living room|media room/, "Living / Media"],
    [/kitchen/, "Kitchen"],
    [/primary bedroom|master bedroom/, "Primary Bedroom"],
    [/bed(room)?\s*\d*|guest bedroom/, "Bedroom"],
    [/primary bath|master bath/, "Primary Bathroom"],
    [/bath(room)?|powder room|wc\b/, "Bathroom"],
    [/office|study/, "Office"],
    [/dining/, "Dining"],
    [/foyer|entry|vestibule/, "Entry"],
    [/hall|corridor/, "Hall"],
    [/closet|wic|wardrobe/, "Closet"],
    [/laundry/, "Laundry"],
    [/terrace|patio|deck|balcony/, "Terrace"],
    [/play room|playroom/, "Play Room"],
    [/garage/, "Garage"],
  ];

  for (const [pattern, type] of patterns) {
    if (pattern.test(value)) return type;
  }

  return null;
}

function layerLooksLike(layer: string, tokens: string[]) {
  const value = layer.toLowerCase();
  return tokens.some((token) => value.includes(token));
}

function angleToRadians(value: number) {
  if (Math.abs(value) > Math.PI * 2 + 0.01) return (value * Math.PI) / 180;
  return value;
}

function collectBounds(primitives: DxfPrimitive[]): DxfBounds {
  const points: Point2D[] = [];

  for (const primitive of primitives) {
    if (primitive.kind === "line") {
      points.push(primitive.start, primitive.end);
    } else if (primitive.kind === "polyline") {
      points.push(...primitive.points);
    } else if (primitive.kind === "circle" || primitive.kind === "arc") {
      points.push(
        { x: primitive.center.x - primitive.radius, y: primitive.center.y - primitive.radius },
        { x: primitive.center.x + primitive.radius, y: primitive.center.y + primitive.radius },
      );
    } else {
      points.push(primitive.position);
    }
  }

  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 100, maxY: 100, width: 100, height: 100 };
  }

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(maxX - minX, 1),
    height: Math.max(maxY - minY, 1),
  };
}

function buildRecommendations(
  rooms: RoomCandidate[],
  analysisBase: Pick<DrawingAnalysis, "wallLikeEntities" | "doorLikeEntities" | "windowLikeEntities">,
): DraftRecommendation[] {
  const recommendations: DraftRecommendation[] = [];
  let sequence = 1;

  const add = (
    system: DraftRecommendation["system"],
    room: string | undefined,
    title: string,
    rationale: string,
    confidence: DraftRecommendation["confidence"],
  ) => {
    recommendations.push({
      id: `draft-${sequence++}`,
      system,
      room,
      title,
      rationale,
      confidence,
    });
  };

  for (const room of rooms) {
    const roomName = room.label || room.normalizedType;

    if (room.normalizedType === "Living / Media") {
      add(
        "Video",
        roomName,
        "Review primary display wall",
        "Room label and geometry indicate a likely entertainment zone. Confirm furniture orientation and millwork before selecting the display wall.",
        "Medium",
      );
      add(
        "Audio",
        roomName,
        "Evaluate passive LCR / custom soundbar solution",
        "A living/media space is a strong candidate for Leon, James, or other passive architectural audio depending on TV width, aesthetics, and budget.",
        "Medium",
      );
      add(
        "Network",
        roomName,
        "Validate Wi-Fi coverage and wired media drops",
        "Entertainment spaces should be checked for AP coverage plus hardwired network connectivity for AV endpoints.",
        "High",
      );
    }

    if (room.normalizedType === "Kitchen") {
      add(
        "Lighting",
        roomName,
        "Separate ambient, task, and decorative lighting intent",
        "Kitchen geometry commonly requires distinct control zones rather than a single general-lighting circuit.",
        "High",
      );
      add(
        "QTL",
        roomName,
        "Inspect cabinetry for linear-lighting runs",
        "Kitchen millwork is a common location for under-cabinet, shelf, cove, or toe-kick linear lighting. Exact run geometry must be verified.",
        "Medium",
      );
    }

    if (room.normalizedType === "Primary Bedroom" || room.normalizedType === "Bedroom") {
      add(
        "Lutron",
        roomName,
        "Plan entry and bedside lighting control",
        "Bedroom control usually benefits from scene access at the entry and bedside, subject to the final keypad and client-programming strategy.",
        "Medium",
      );
      add(
        "Shades",
        roomName,
        "Review blackout-shade requirement",
        "Sleeping spaces are common candidates for blackout treatment. Window dimensions, pockets, fabric, and side-channel requirements remain project-specific.",
        "Review",
      );
    }

    if (room.normalizedType === "Office") {
      add(
        "Network",
        roomName,
        "Plan hardwired workstation and printer connectivity",
        "Office spaces should be checked for desk data drops, printer/network requirements, and Wi-Fi coverage.",
        "High",
      );
      add(
        "Lighting",
        roomName,
        "Review task-lighting strategy",
        "Desk/work surfaces benefit from dedicated task-lighting analysis in addition to ambient lighting.",
        "Medium",
      );
    }

    if (room.normalizedType === "Dining") {
      add(
        "Lighting",
        roomName,
        "Separate decorative fixture and ambient control",
        "Dining rooms frequently need independent dimming for pendants/chandeliers and surrounding architectural lighting.",
        "High",
      );
    }

    if (room.normalizedType === "Entry") {
      add(
        "Lutron",
        roomName,
        "Create arrival / away control point",
        "Entry areas are common locations for whole-home scenes such as Welcome, Entertain, Evening, and Away.",
        "Medium",
      );
    }

    if (room.normalizedType === "Terrace") {
      add(
        "Infrastructure",
        roomName,
        "Review outdoor-rated cabling and equipment",
        "Exterior zones require weather-rated products, protected pathways, and direct-burial/outdoor cabling where applicable.",
        "High",
      );
    }
  }

  if (analysisBase.wallLikeEntities > 0) {
    add(
      "Network",
      undefined,
      "Use wall geometry for RF candidate scoring",
      "Wall-like DXF entities were detected and can later feed attenuation-aware AP placement calculations.",
      "High",
    );
  }

  if (analysisBase.doorLikeEntities > 0) {
    add(
      "Lutron",
      undefined,
      "Use door locations for keypad candidate placement",
      "Door-like entities were detected and can later help identify room entries and control points.",
      "High",
    );
  }

  return recommendations.slice(0, 40);
}

export function parseDxf(text: string): ParsedDxfDrawing {
  const parser = new DxfParser();
  const dxf = parser.parseSync(text) as unknown as Record<string, any>;

  if (!dxf) {
    throw new Error("The DXF parser returned no drawing.");
  }

  const entities: any[] = Array.isArray(dxf.entities) ? dxf.entities : [];
  const primitives: DxfPrimitive[] = [];
  const layerCounts = new Map<string, number>();
  const potentialRooms: RoomCandidate[] = [];

  let lineCount = 0;
  let polylineCount = 0;
  let circleCount = 0;
  let arcCount = 0;
  let textCount = 0;
  let dimensionCount = 0;
  let insertCount = 0;
  let wallLikeEntities = 0;
  let doorLikeEntities = 0;
  let windowLikeEntities = 0;

  for (const entity of entities) {
    const type = String(entity.type || "").toUpperCase();
    const layer = String(entity.layer || "0");

    layerCounts.set(layer, (layerCounts.get(layer) || 0) + 1);

    if (layerLooksLike(layer, ["wall", "a-wall"])) wallLikeEntities += 1;
    if (layerLooksLike(layer, ["door", "a-door"])) doorLikeEntities += 1;
    if (layerLooksLike(layer, ["window", "glaz", "a-glaz"])) windowLikeEntities += 1;

    if (type === "LINE") {
      const start = finitePoint(entity.vertices?.[0] ?? entity.start);
      const end = finitePoint(entity.vertices?.[1] ?? entity.end);
      if (start && end) {
        primitives.push({ kind: "line", layer, start, end });
        lineCount += 1;
      }
      continue;
    }

    if (type === "LWPOLYLINE" || type === "POLYLINE") {
      const vertices = Array.isArray(entity.vertices) ? entity.vertices : [];
      const points = vertices.map(finitePoint).filter(Boolean) as Point2D[];
      if (points.length >= 2) {
        primitives.push({
          kind: "polyline",
          layer,
          points,
          closed: Boolean(entity.shape || entity.closed),
        });
        polylineCount += 1;
      }
      continue;
    }

    if (type === "CIRCLE") {
      const center = finitePoint(entity.center);
      const radius = Number(entity.radius);
      if (center && Number.isFinite(radius) && radius > 0) {
        primitives.push({ kind: "circle", layer, center, radius });
        circleCount += 1;
      }
      continue;
    }

    if (type === "ARC") {
      const center = finitePoint(entity.center);
      const radius = Number(entity.radius);
      const startAngle = Number(entity.startAngle);
      const endAngle = Number(entity.endAngle);
      if (
        center &&
        Number.isFinite(radius) &&
        Number.isFinite(startAngle) &&
        Number.isFinite(endAngle)
      ) {
        primitives.push({
          kind: "arc",
          layer,
          center,
          radius,
          startAngle: angleToRadians(startAngle),
          endAngle: angleToRadians(endAngle),
        });
        arcCount += 1;
      }
      continue;
    }

    if (type === "TEXT" || type === "MTEXT") {
      const position = finitePoint(entity.startPoint ?? entity.position);
      const textValue = cleanText(entity.text ?? entity.string ?? entity.value);
      if (position && textValue) {
        primitives.push({
          kind: "text",
          layer,
          position,
          text: textValue,
          height: Number.isFinite(Number(entity.textHeight))
            ? Number(entity.textHeight)
            : undefined,
        });
        textCount += 1;

        const normalizedType = normalizeRoomType(textValue);
        if (normalizedType) {
          potentialRooms.push({
            label: textValue,
            normalizedType,
            position,
            layer,
          });
        }
      }
      continue;
    }

    if (type === "INSERT") {
      const position = finitePoint(entity.position);
      if (position) {
        const name = String(entity.name || entity.block || "BLOCK");
        primitives.push({ kind: "insert", layer, position, name });
        insertCount += 1;

        if (layerLooksLike(layer, ["door"]) || /door/i.test(name)) {
          doorLikeEntities += 1;
        }
        if (layerLooksLike(layer, ["window", "glaz"]) || /window|glaz/i.test(name)) {
          windowLikeEntities += 1;
        }
      }
      continue;
    }

    if (type === "DIMENSION") {
      dimensionCount += 1;
    }
  }

  const bounds = collectBounds(primitives);

  const rawUnitCode = Number(dxf.header?.$INSUNITS ?? dxf.header?.INSUNITS ?? 0);
  const units = UNIT_CODES[rawUnitCode] || `DXF unit code ${rawUnitCode}`;

  const dedupedRooms = potentialRooms.filter((room, index, all) => {
    const key = room.label.toLowerCase();
    return all.findIndex((candidate) => candidate.label.toLowerCase() === key) === index;
  });

  const layers = Array.from(layerCounts.entries())
    .map(([name, entityCount]) => ({ name, entityCount }))
    .sort((a, b) => b.entityCount - a.entityCount);

  const analysis: DrawingAnalysis = {
    sourceType: "DXF",
    units,
    bounds,
    entityCount: entities.length,
    lineCount,
    polylineCount,
    circleCount,
    arcCount,
    textCount,
    dimensionCount,
    insertCount,
    layerCount: layers.length,
    layers,
    potentialRooms: dedupedRooms,
    wallLikeEntities,
    doorLikeEntities,
    windowLikeEntities,
  };

  return {
    primitives,
    analysis,
    recommendations: buildRecommendations(dedupedRooms, analysis),
  };
}

export function arcPoints(primitive: Extract<DxfPrimitive, { kind: "arc" }>, segments = 32) {
  let start = primitive.startAngle;
  let end = primitive.endAngle;

  while (end < start) end += Math.PI * 2;

  const count = Math.max(8, Math.min(segments, Math.ceil(((end - start) / (Math.PI * 2)) * segments)));
  const points: Point2D[] = [];

  for (let index = 0; index <= count; index += 1) {
    const angle = start + ((end - start) * index) / count;
    points.push({
      x: primitive.center.x + Math.cos(angle) * primitive.radius,
      y: primitive.center.y + Math.sin(angle) * primitive.radius,
    });
  }

  return points;
}
