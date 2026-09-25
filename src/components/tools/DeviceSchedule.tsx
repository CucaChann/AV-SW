import { deviceType, LAYER_DEFINITIONS } from "../../lib/deviceCatalog";
import type { ScaleLookup } from "../../lib/designBom";
import {
  formatFeet,
  layerOf,
  runLengthFt,
  unverifiedSheetKeys,
  type PlanDesign,
  type PlanItem,
} from "../../lib/planDesign";
import { exportCsv } from "../../lib/projectTools";

type Props = {
  design: PlanDesign;
  scaleOf: ScaleLookup;
  onShowPlan: () => void;
  onShowItem: (itemId: string) => void;
};

const byTag = (a: PlanItem, b: PlanItem) => a.tag.localeCompare(b.tag, undefined, { numeric: true });

export default function DeviceSchedule({ design, scaleOf, onShowPlan, onShowItem }: Props) {
  const sections = LAYER_DEFINITIONS.map((layer) => ({
    layer,
    items: design.items.filter((item) => layerOf(item) === layer.key).sort(byTag),
  })).filter((section) => section.items.length > 0);

  const lengthOf = (item: PlanItem) => {
    if (item.kind !== "run") return "";
    const feet = runLengthFt(item, scaleOf(item));
    return feet === null ? "needs scale" : formatFeet(feet);
  };

  const devices = design.items.filter((item) => item.kind === "device").length;
  const runs = design.items.length - devices;
  const unassigned = design.items.filter((item) => !item.room.trim()).length;
  const unverified = unverifiedSheetKeys(design);
  const isUnverified = (item: PlanItem) => unverified.has(`${item.drawingId}:${item.page}`);
  const unverifiedCount = design.items.filter(isUnverified).length;
  const noModel = design.items.filter((item) => !item.model.trim()).length;

  const exportSchedule = () =>
    exportCsv("avsw-device-schedule.csv", [
      ["Layer", "Tag", "Type", "Room", "Brand", "Model", "Length / width", "Cable", "Alignment", "Notes"],
      ...sections.flatMap(({ layer, items }) =>
        items.map((item) => [
          layer.name,
          item.tag,
          deviceType(item.typeId)?.name ?? item.typeId,
          item.room,
          item.brand,
          item.model,
          lengthOf(item),
          deviceType(item.typeId)?.measures === "cable" ? `${item.quantity} × ${item.cableType}` : "",
          isUnverified(item) ? "Not verified" : "",
          item.notes,
        ]),
      ),
    ]);

  return (
    <div className="tool-page">
      <div className="tool-page-heading">
        <div>
          <span className="eyebrow">Floor plan</span>
          <h1>Device Schedule</h1>
          <p>Every device and run placed on the plan, by layer. Click a tag to find it on the drawing; edits there update this schedule and the BOM.</p>
        </div>
        <div className="tool-action-row">
          <button onClick={onShowPlan}>Open plan</button>
          <button className="primary" onClick={exportSchedule} disabled={design.items.length === 0}>
            Export CSV
          </button>
        </div>
      </div>

      <div className="tool-summary-grid">
        <article><span>Devices</span><strong>{devices}</strong></article>
        <article><span>Runs</span><strong>{runs}</strong></article>
        <article><span>No room assigned</span><strong>{unassigned}</strong></article>
        <article><span>No model selected</span><strong>{noModel}</strong></article>
        {unverifiedCount > 0 && (
          <article className="attention">
            <span>Alignment not verified</span>
            <strong>{unverifiedCount}</strong>
          </article>
        )}
      </div>

      {unverifiedCount > 0 && (
        <p className="attention-text">
          ⚠ {unverifiedCount} item{unverifiedCount === 1 ? " was" : "s were"} carried over from a replaced drawing and
          {unverifiedCount === 1 ? " hasn't" : " haven't"} been checked against the new one. Open the plan to align or confirm
          them; until then their rooms and lengths may be off.
        </p>
      )}

      {sections.length === 0 && (
        <section className="builder-card">
          <h3>Nothing placed yet</h3>
          <p className="muted">
            Open the plan, choose a layer in the Design panel and click a device, then click on the drawing to place it.
          </p>
        </section>
      )}

      {sections.map(({ layer, items }) => (
        <section className="builder-card schedule-section" key={layer.key}>
          <h3>
            <span className="design-layer-swatch" style={{ background: layer.color }} />
            {layer.name}
            <span className="muted">{items.length}</span>
          </h3>
          <table className="schedule-table">
            <thead>
              <tr>
                <th>Tag</th>
                <th>Type</th>
                <th>Room</th>
                <th>Brand</th>
                <th>Model</th>
                <th>Length / width</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className={isUnverified(item) ? "unverified" : ""}>
                  <td>
                    <button className="schedule-tag" onClick={() => onShowItem(item.id)} title="Show on plan">
                      {item.tag || "—"}
                    </button>
                    {isUnverified(item) && (
                      <span className="schedule-flag" title="Alignment with the revised drawing isn't verified">
                        ⚠
                      </span>
                    )}
                  </td>
                  <td>{deviceType(item.typeId)?.name}</td>
                  <td className={item.room.trim() ? "" : "muted"}>{item.room || "—"}</td>
                  <td>{item.brand || "—"}</td>
                  <td className={item.model.trim() ? "" : "muted"}>{item.model || "not selected"}</td>
                  <td>{lengthOf(item)}</td>
                  <td>{item.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
