import type { DxfPrimitive, ParsedDxfDrawing, Point2D } from "../lib/dxf";
import { arcPoints } from "../lib/dxf";

type Props = {
  drawing: ParsedDxfDrawing;
};

const BASELINES = {
  alphabetic: "alphabetic",
  bottom: "text-after-edge",
  middle: "central",
  top: "hanging",
} as const;

function layerColor(layer: string) {
  const value = layer.toLowerCase();

  if (value.includes("wall")) return "var(--dxf-wall)";
  if (value.includes("door")) return "var(--dxf-door)";
  if (value.includes("glaz") || value.includes("window")) return "var(--dxf-window)";
  if (value.includes("lite") || value.includes("light")) return "var(--dxf-light)";
  if (value.includes("furn")) return "var(--dxf-furniture)";
  if (value.includes("anno") || value.includes("text")) return "var(--dxf-annotation)";

  return "var(--dxf-default)";
}

export default function DxfCanvas({ drawing }: Props) {
  const { bounds } = drawing.analysis;

  const x = (value: number) => value - bounds.minX;
  const y = (value: number) => bounds.maxY - value;
  const strokeWidth = Math.max(bounds.width, bounds.height) / 1800;

  function pointList(points: Point2D[]) {
    return points.map((point) => `${x(point.x)},${y(point.y)}`).join(" ");
  }

  function renderPrimitive(primitive: DxfPrimitive, index: number) {
    const color = layerColor(primitive.layer);

    if (primitive.kind === "line") {
      return (
        <line
          key={index}
          x1={x(primitive.start.x)}
          y1={y(primitive.start.y)}
          x2={x(primitive.end.x)}
          y2={y(primitive.end.y)}
          stroke={color}
          strokeWidth={strokeWidth}
          vectorEffect="non-scaling-stroke"
        />
      );
    }

    if (primitive.kind === "polyline") {
      const points = primitive.closed
        ? [...primitive.points, primitive.points[0]]
        : primitive.points;

      return (
        <polyline
          key={index}
          points={pointList(points)}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          vectorEffect="non-scaling-stroke"
        />
      );
    }

    if (primitive.kind === "circle") {
      return (
        <circle
          key={index}
          cx={x(primitive.center.x)}
          cy={y(primitive.center.y)}
          r={primitive.radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          vectorEffect="non-scaling-stroke"
        />
      );
    }

    if (primitive.kind === "arc") {
      return (
        <polyline
          key={index}
          points={pointList(arcPoints(primitive))}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          vectorEffect="non-scaling-stroke"
        />
      );
    }

    if (primitive.kind === "insert") {
      const size = Math.max(bounds.width, bounds.height) / 500;
      const px = x(primitive.position.x);
      const py = y(primitive.position.y);

      return (
        <g key={index} aria-label={primitive.name}>
          <line
            x1={px - size}
            y1={py}
            x2={px + size}
            y2={py}
            stroke="var(--dxf-insert)"
            strokeWidth={strokeWidth}
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1={px}
            y1={py - size}
            x2={px}
            y2={py + size}
            stroke="#ff922b"
            strokeWidth={strokeWidth}
            vectorEffect="non-scaling-stroke"
          />
        </g>
      );
    }

    if (primitive.kind === "text") {
      const fontSize = Math.max(
        primitive.height || Math.max(bounds.width, bounds.height) / 250,
        Math.max(bounds.width, bounds.height) / 700,
      );
      const tx = x(primitive.position.x);
      const ty = y(primitive.position.y);

      return (
        <text
          key={index}
          x={tx}
          y={ty}
          fill="var(--dxf-text)"
          fontSize={fontSize}
          fontFamily="Arial, sans-serif"
          textAnchor={primitive.anchor ?? "start"}
          dominantBaseline={BASELINES[primitive.baseline ?? "alphabetic"]}
          // Drawing y points up, SVG y points down, so a CCW angle becomes negative.
          transform={primitive.rotation ? `rotate(${-primitive.rotation} ${tx} ${ty})` : undefined}
        >
          {primitive.text}
        </text>
      );
    }

    return null;
  }

  return (
    <svg
      className="dxf-svg"
      viewBox={`0 0 ${bounds.width} ${bounds.height}`}
      width={bounds.width}
      height={bounds.height}
      role="img"
      aria-label="DXF drawing"
    >
      <rect width={bounds.width} height={bounds.height} fill="var(--dxf-background)" />
      {drawing.primitives.map(renderPrimitive)}
    </svg>
  );
}
