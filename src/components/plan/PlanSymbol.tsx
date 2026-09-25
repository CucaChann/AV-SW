import type { SymbolShape } from "../../lib/deviceCatalog";

type Props = {
  shape: SymbolShape;
  size: number;
  color: string;
  code: string;
};

/** A device symbol centered on 0,0: layer-colored outline, tinted fill, short code. */
export default function PlanSymbol({ shape, size, color, code }: Props) {
  const half = size / 2;
  const common = {
    fill: color,
    fillOpacity: 0.22,
    stroke: color,
    strokeWidth: size * 0.08,
  };

  let outline;
  if (shape === "circle") {
    outline = <circle r={half} {...common} />;
  } else if (shape === "square") {
    outline = <rect x={-half} y={-half} width={size} height={size} rx={size * 0.12} {...common} />;
  } else if (shape === "diamond") {
    outline = <polygon points={`0,${-half * 1.15} ${half * 1.15},0 0,${half * 1.15} ${-half * 1.15},0`} {...common} />;
  } else if (shape === "triangle") {
    outline = <polygon points={`0,${-half * 1.1} ${half * 1.1},${half * 0.9} ${-half * 1.1},${half * 0.9}`} {...common} />;
  } else if (shape === "hexagon") {
    const points = Array.from({ length: 6 }, (_, index) => {
      const angle = (Math.PI / 3) * index;
      return `${Math.cos(angle) * half * 1.1},${Math.sin(angle) * half * 1.1}`;
    }).join(" ");
    outline = <polygon points={points} {...common} />;
  } else {
    outline = <rect x={-size * 0.85} y={-half * 0.7} width={size * 1.7} height={size * 0.7} rx={size * 0.1} {...common} />;
  }

  return (
    <>
      {outline}
      <text
        className="plan-symbol-code"
        strokeWidth={size * 0.06}
        fontSize={size * (code.length > 2 ? 0.34 : 0.42)}
        textAnchor="middle"
        dominantBaseline="central"
        y={shape === "triangle" ? size * 0.12 : 0}
      >
        {code}
      </text>
    </>
  );
}
