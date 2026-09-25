import { layerDefinition, typesForLayer, type LayerKey } from "../../lib/deviceCatalog";
import { layerOf, type DesignLayer, type PlanItem } from "../../lib/planDesign";
import PlanSymbol from "./PlanSymbol";

type Props = {
  layers: DesignLayer[];
  /** Items on the sheet being viewed, for per-layer counts. */
  sheetItems: PlanItem[];
  activeLayer: LayerKey;
  armedTypeId: string | null;
  showTags: boolean;
  onActiveLayer: (key: LayerKey) => void;
  onToggleVisible: (key: LayerKey) => void;
  onToggleLocked: (key: LayerKey) => void;
  onPickType: (typeId: string) => void;
  onShowTags: (show: boolean) => void;
  onClose: () => void;
};

export default function DesignPanel({
  layers,
  sheetItems,
  activeLayer,
  armedTypeId,
  showTags,
  onActiveLayer,
  onToggleVisible,
  onToggleLocked,
  onPickType,
  onShowTags,
  onClose,
}: Props) {
  const counts = new Map<LayerKey, number>();
  for (const item of sheetItems) {
    const key = layerOf(item);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const active = layers.find((layer) => layer.key === activeLayer);
  const definition = layerDefinition(activeLayer);

  return (
    <aside className="design-panel" onMouseDown={(event) => event.stopPropagation()}>
      <header className="design-panel-header">
        <strong>Design layers</strong>
        <button className="design-panel-close" onClick={onClose} aria-label="Hide design layers">
          ×
        </button>
      </header>

      <ul className="design-layers">
        {layers.map((layer) => {
          const info = layerDefinition(layer.key);
          return (
            <li key={layer.key} className={layer.key === activeLayer ? "active" : ""}>
              <button className="design-layer-name" onClick={() => onActiveLayer(layer.key)}>
                <span className="design-layer-swatch" style={{ background: info.color }} />
                <span>{info.name}</span>
                <span className="design-layer-count">{counts.get(layer.key) ?? 0}</span>
              </button>
              <button
                className={`design-layer-toggle ${layer.visible ? "" : "off"}`}
                onClick={() => onToggleVisible(layer.key)}
                title={layer.visible ? "Hide layer" : "Show layer"}
                aria-label={`${layer.visible ? "Hide" : "Show"} ${info.name}`}
              >
                {layer.visible ? "◉" : "○"}
              </button>
              <button
                className={`design-layer-toggle ${layer.locked ? "on" : ""}`}
                onClick={() => onToggleLocked(layer.key)}
                title={layer.locked ? "Unlock layer" : "Lock layer"}
                aria-label={`${layer.locked ? "Unlock" : "Lock"} ${info.name}`}
              >
                {layer.locked ? "🔒" : "🔓"}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="design-palette">
        <div className="design-palette-title">
          <span>{definition.name}</span>
          {active?.locked && <span className="design-palette-note">Layer locked</span>}
        </div>
        {typesForLayer(activeLayer).map((type) => (
          <button
            key={type.id}
            className={`design-palette-item ${armedTypeId === type.id ? "armed" : ""}`}
            disabled={active?.locked || !active?.visible}
            onClick={() => onPickType(type.id)}
            title={type.shape === "line" ? "Click points on the plan; double-click or Enter to finish" : "Click on the plan to place; Esc to stop"}
          >
            <svg width="30" height="22" viewBox="-15 -11 30 22" aria-hidden="true">
              <PlanSymbol shape={type.symbol} size={16} color={definition.color} code={type.code} />
            </svg>
            <span>{type.name}</span>
            {type.shape === "line" && <span className="design-palette-kind">line</span>}
          </button>
        ))}
      </div>

      <label className="design-panel-option">
        <input type="checkbox" checked={showTags} onChange={(event) => onShowTags(event.target.checked)} />
        Show tags and lengths
      </label>
      <p className="design-panel-hint">
        Drag empty space to pan · wheel to zoom · Shift keeps lines straight · Esc stops · Delete removes · R rotates · Ctrl+Z undo
      </p>
    </aside>
  );
}
