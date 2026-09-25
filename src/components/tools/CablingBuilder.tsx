import {
  cableRunTotal,
  cableSummary,
  exportCsv,
  newCableRun,
  type CableRun,
  type CableType,
  type ProjectToolsState,
} from "../../lib/projectTools";

type Props = {
  state: ProjectToolsState;
  onChange: (state: ProjectToolsState) => void;
};

const TYPES: CableType[] = [
  "CAT6A","CAT6","Fiber OM4","RG6","14/2 Speaker","14/4 Speaker",
  "16/2 Speaker","16/4 Speaker","18/2","18/4","Lutron / Control Cable",
  "Shade Power / Control","HDMI / Fiber Pathway","Other",
];

export default function CablingBuilder({ state, onChange }: Props) {
  const addRun = () => onChange({ ...state, cableRuns: [...state.cableRuns, newCableRun()] });
  const updateRun = (id: string, patch: Partial<CableRun>) =>
    onChange({ ...state, cableRuns: state.cableRuns.map((run) => run.id === id ? { ...run, ...patch } : run) });
  const removeRun = (id: string) =>
    onChange({ ...state, cableRuns: state.cableRuns.filter((run) => run.id !== id) });

  const summary = cableSummary(state.cableRuns);

  const exportRuns = () =>
    exportCsv("av-sw-cable-schedule.csv", [
      ["From","To","Cable","Measured ft","Vertical allowance ft","Service loop %","Waste %","Qty","Total ft","Notes"],
      ...state.cableRuns.map((run) => [
        run.from, run.to, run.cableType, String(run.measuredFt), String(run.verticalAllowanceFt),
        String(run.serviceLoopPct), String(run.wastePct), String(run.quantity), String(cableRunTotal(run)), run.notes,
      ]),
    ]);

  return (
    <div className="tool-page">
      <div className="tool-page-heading">
        <div>
          <span className="eyebrow">Infrastructure Builder</span>
          <h1>Cabling + Run Schedule</h1>
          <p>Estimate realistic footage from measured pathways plus vertical allowance, service loops, waste and quantity.</p>
        </div>
        <div className="tool-action-row">
          <button className="primary" onClick={addRun}>+ Add Run</button>
          <button onClick={exportRuns} disabled={!state.cableRuns.length}>Export Cable CSV</button>
        </div>
      </div>

      {!!summary.length && (
        <div className="tool-summary-grid">
          {summary.slice(0, 8).map((item) => <article key={item.type}><span>{item.type}</span><strong>{item.feet} ft</strong></article>)}
        </div>
      )}

      {!state.cableRuns.length && <div className="tool-empty">Add runs from rack/panel locations to APs, TVs, speakers, shades, keypads, cameras and other endpoints.</div>}

      <div className="builder-list">
        {state.cableRuns.map((run, index) => (
          <article className="builder-card" key={run.id}>
            <div className="builder-card-header">
              <div><span className="eyebrow">Run {index + 1}</span><h3>{run.from} → {run.to || "TBD"}</h3></div>
              <button onClick={() => removeRun(run.id)}>Remove</button>
            </div>

            <div className="builder-form-grid three">
              <label className="field"><span>From</span><input value={run.from} onChange={(e) => updateRun(run.id, { from: e.target.value })} /></label>
              <label className="field"><span>To</span><input value={run.to} onChange={(e) => updateRun(run.id, { to: e.target.value })} /></label>
              <label className="field"><span>Cable type</span><select value={run.cableType} onChange={(e) => updateRun(run.id, { cableType: e.target.value as CableType })}>{TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
              <label className="field"><span>Measured path ft</span><input type="number" min="0" value={run.measuredFt} onChange={(e) => updateRun(run.id, { measuredFt: Number(e.target.value) || 0 })} /></label>
              <label className="field"><span>Vertical allowance ft</span><input type="number" min="0" value={run.verticalAllowanceFt} onChange={(e) => updateRun(run.id, { verticalAllowanceFt: Number(e.target.value) || 0 })} /></label>
              <label className="field"><span>Quantity</span><input type="number" min="1" value={run.quantity} onChange={(e) => updateRun(run.id, { quantity: Number(e.target.value) || 1 })} /></label>
              <label className="field"><span>Service loop %</span><input type="number" min="0" value={run.serviceLoopPct} onChange={(e) => updateRun(run.id, { serviceLoopPct: Number(e.target.value) || 0 })} /></label>
              <label className="field"><span>Waste %</span><input type="number" min="0" value={run.wastePct} onChange={(e) => updateRun(run.id, { wastePct: Number(e.target.value) || 0 })} /></label>
            </div>

            <div className="calculation-strip"><div><span>Estimated total</span><strong>{cableRunTotal(run)} ft</strong></div></div>

            <label className="field"><span>Notes / pathway</span><textarea rows={2} value={run.notes} onChange={(e) => updateRun(run.id, { notes: e.target.value })} /></label>
          </article>
        ))}
      </div>
    </div>
  );
}
