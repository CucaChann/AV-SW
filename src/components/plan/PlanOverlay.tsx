import { deviceType, layerDefinition } from "../../lib/deviceCatalog";
import {
  formatFeet,
  polylineLength,
  type DrawingScale,
  type PlanItem,
  type PlanPoint,
} from "../../lib/planDesign";
import type { SheetGeometry } from "../../lib/planGeometry";
import PlanSymbol from "./PlanSymbol";

export type PlanPreview =
  | { kind: "run"; typeId: string; points: PlanPoint[]; cursor: PlanPoint | null }
  | { kind: "measure" | "calibrate"; points: PlanPoint[]; cursor: PlanPoint | null };

type Props = {
  sheet: SheetGeometry;
  items: PlanItem[];
  zoom: number;
  selectedId: string | null;
  showTags: boolean;
  scale: DrawingScale | undefined;
  preview: PlanPreview | null;
};

/** Screen-pixel sizes; divided by zoom so symbols stay the same size on screen. */
const SYMBOL_PX = 24;
const LABEL_PX = 11;
const RUN_PX = 3;
const HIT_PX = 14;
const SELECTION = "#22d3ee";

function lengthLabel(points: PlanPoint[], scale: DrawingScale | undefined) {
  if (points.length < 2) return "";
  return scale ? formatFeet(polylineLength(points) / scale.unitsPerFoot) : "set scale";
}

export default function PlanOverlay({ sheet, items, zoom, selectedId, showTags, scale, preview }: Props) {
  const px = (value: number) => value / zoom;
  const stagePoints = (points: PlanPoint[]) =>
    points.map((point) => sheet.toStage(point)).map((p) => `${p.x},${p.y}`).join(" ");

  function label(text: string, at: PlanPoint, color = "var(--plan-label)") {
    return (
      <text
        className="plan-label"
        x={at.x}
        y={at.y}
        fontSize={px(LABEL_PX)}
        strokeWidth={px(2.5)}
        fill={color}
        textAnchor="middle"
        dominantBaseline="hanging"
      >
        {text}
      </text>
    );
  }

  function renderItem(item: PlanItem) {
    const type = deviceType(item.typeId);
    if (!type) return null;
    const color = layerDefinition(type.layer).color;
    const selected = item.id === selectedId;

    if (item.kind === "device") {
      const at = sheet.toStage(item.at);
      const size = px(SYMBOL_PX);
      return (
        <g key={item.id} data-item-id={item.id} className="plan-item">
          <g transform={`translate(${at.x} ${at.y}) rotate(${-item.rotation})`}>
            {selected && (
              <circle r={size * 0.95} fill="none" stroke={SELECTION} strokeWidth={px(2)} strokeDasharray={`${px(4)} ${px(3)}`} />
            )}
            <PlanSymbol shape={type.symbol} size={size} color={color} code={type.code} />
          </g>
          {showTags && item.tag && label(item.tag, { x: at.x, y: at.y + size * 0.75 })}
        </g>
      );
    }

    const points = item.points.map((point) => sheet.toStage(point));
    const middle = points[Math.floor((points.length - 1) / 2)];
    const next = points[Math.floor((points.length - 1) / 2) + 1] ?? middle;
    const labelAt = { x: (middle.x + next.x) / 2, y: (middle.y + next.y) / 2 + px(6) };
    const pointList = points.map((p) => `${p.x},${p.y}`).join(" ");

    return (
      <g key={item.id} data-item-id={item.id} className="plan-item">
        <polyline points={pointList} className="plan-hit" strokeWidth={px(HIT_PX)} />
        {selected && (
          <polyline points={pointList} fill="none" stroke={SELECTION} strokeWidth={px(RUN_PX + 5)} strokeOpacity={0.45} strokeLinejoin="round" strokeLinecap="round" />
        )}
        <polyline
          points={pointList}
          fill="none"
          stroke={color}
          strokeWidth={px(RUN_PX)}
          strokeLinejoin="round"
          strokeLinecap="round"
          strokeDasharray={type.measures === "pathway" ? `${px(8)} ${px(5)}` : undefined}
        />
        {points.map((point, index) => (
          <circle key={index} cx={point.x} cy={point.y} r={px(3.5)} fill={color} />
        ))}
        {showTags && label(`${item.tag} · ${lengthLabel(item.points, scale)}`, labelAt)}
      </g>
    );
  }

  function renderPreview() {
    if (!preview) return null;
    const points = preview.cursor ? [...preview.points, preview.cursor] : preview.points;
    if (points.length === 0) return null;
    const color =
      preview.kind === "run"
        ? layerDefinition(deviceType(preview.typeId)?.layer ?? "cabling").color
        : SELECTION;
    const stage = points.map((point) => sheet.toStage(point));
    const last = stage[stage.length - 1];
    return (
      <g className="plan-preview">
        <polyline
          points={stagePoints(points)}
          fill="none"
          stroke={color}
          strokeWidth={px(RUN_PX)}
          strokeDasharray={`${px(6)} ${px(4)}`}
        />
        {stage.map((point, index) => (
          <circle key={index} cx={point.x} cy={point.y} r={px(4)} fill={color} />
        ))}
        {points.length >= 2 &&
          preview.kind !== "calibrate" &&
          label(lengthLabel(points, scale), { x: last.x, y: last.y + px(8) }, color)}
      </g>
    );
  }

  return (
    <svg
      className="plan-overlay"
      width={sheet.width}
      height={sheet.height}
      viewBox={`0 0 ${sheet.width} ${sheet.height}`}
    >
      {items.map(renderItem)}
      {renderPreview()}
    </svg>
  );
}
