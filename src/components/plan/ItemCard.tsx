import { useState } from "react";
import { CABLE_TYPES, deviceType, layerDefinition } from "../../lib/deviceCatalog";
import { formatFeet, type PlanItem } from "../../lib/planDesign";

type Props = {
  item: PlanItem;
  /** Real length of a run, or null when the sheet has no scale. */
  lengthFt: number | null;
  rooms: string[];
  locked: boolean;
  onChange: (patch: Partial<PlanItem>, field: string) => void;
  onRotate: (degrees: number) => void;
  onDelete: () => void;
  onClose: () => void;
  /** Extra actions for this item (e.g. linking a linear run to QTL Studio). */
  actions?: React.ReactNode;
};

const OTHER = "__other__";

/** Properties of the selected plan item. Render with key={item.id}. */
export default function ItemCard({
  item,
  lengthFt,
  rooms,
  locked,
  onChange,
  onRotate,
  onDelete,
  onClose,
  actions,
}: Props) {
  const type = deviceType(item.typeId);
  const [customBrand, setCustomBrand] = useState(
    Boolean(item.brand) && !type?.brands.includes(item.brand),
  );
  if (!type) return null;
  const layer = layerDefinition(type.layer);

  return (
    <aside className="item-card" onMouseDown={(event) => event.stopPropagation()}>
      <header className="item-card-header">
        <span className="design-layer-swatch" style={{ background: layer.color }} />
        <div>
          <strong>{type.name}</strong>
          <span className="muted">{layer.name}{locked ? " · locked" : ""}</span>
        </div>
        <button className="design-panel-close" onClick={onClose} aria-label="Close item details">
          ×
        </button>
      </header>

      <fieldset disabled={locked}>
        <label className="field">
          <span>Tag</span>
          <input value={item.tag} onChange={(event) => onChange({ tag: event.target.value }, "tag")} />
        </label>

        <label className="field">
          <span>Room / location</span>
          <input
            value={item.room}
            list="plan-rooms"
            placeholder="Unassigned"
            onChange={(event) => onChange({ room: event.target.value }, "room")}
          />
          <datalist id="plan-rooms">
            {rooms.map((room) => (
              <option key={room} value={room} />
            ))}
          </datalist>
        </label>

        <label className="field">
          <span>Brand</span>
          <select
            value={customBrand ? OTHER : item.brand}
            onChange={(event) => {
              const other = event.target.value === OTHER;
              setCustomBrand(other);
              onChange({ brand: other ? "" : event.target.value }, "brand");
            }}
          >
            <option value="">Not selected</option>
            {type.brands.map((brand) => (
              <option key={brand} value={brand}>
                {brand}
              </option>
            ))}
            <option value={OTHER}>Other…</option>
          </select>
        </label>
        {customBrand && (
          <label className="field">
            <span>Other brand</span>
            <input
              value={item.brand}
              autoFocus
              onChange={(event) => onChange({ brand: event.target.value }, "brand")}
            />
          </label>
        )}

        <label className="field">
          <span>Model</span>
          <input
            value={item.model}
            placeholder="From the spec sheet or library"
            onChange={(event) => onChange({ model: event.target.value }, "model")}
          />
        </label>

        {item.kind === "run" && (
          <div className="item-card-length">
            <span>{type.measures === "shade-width" || type.measures === "screen-width" ? "Width" : "Length"}</span>
            <strong>{lengthFt === null ? "Set the sheet scale to measure" : formatFeet(lengthFt)}</strong>
          </div>
        )}

        {type.measures === "cable" && (
          <>
            <label className="field">
              <span>Cable type</span>
              <select value={item.cableType} onChange={(event) => onChange({ cableType: event.target.value }, "cableType")}>
                {CABLE_TYPES.map((cable) => (
                  <option key={cable}>{cable}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Cables along this path</span>
              <input
                type="number"
                min={1}
                value={item.quantity}
                onChange={(event) =>
                  onChange({ quantity: Math.max(1, Math.round(Number(event.target.value) || 1)) }, "quantity")
                }
              />
            </label>
          </>
        )}

        <label className="field">
          <span>Notes</span>
          <textarea rows={2} value={item.notes} onChange={(event) => onChange({ notes: event.target.value }, "notes")} />
        </label>
      </fieldset>

      {actions}

      <div className="item-card-actions">
        {item.kind === "device" && (
          <>
            <button disabled={locked} onClick={() => onRotate(45)} title="Rotate 45° counter-clockwise (R)">
              ⟲ 45°
            </button>
            <button disabled={locked} onClick={() => onRotate(-45)} title="Rotate 45° clockwise (Shift+R)">
              ⟳ 45°
            </button>
          </>
        )}
        <button className="danger" disabled={locked} onClick={onDelete} title="Delete (Del)">
          Delete
        </button>
      </div>
    </aside>
  );
}
