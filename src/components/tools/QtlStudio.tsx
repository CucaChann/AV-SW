import {
  exportCsv,
  newQtlRun,
  qtlDriverMinimum,
  qtlRunPower,
  qtlRunWarnings,
  type ProjectToolsState,
  type QtlRun,
} from "../../lib/projectTools";

type Props = {
  state: ProjectToolsState;
  onChange: (state: ProjectToolsState) => void;
};

function numberValue(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function QtlStudio({ state, onChange }: Props) {
  const addRun = () =>
    onChange({ ...state, qtlRuns: [...state.qtlRuns, newQtlRun()] });

  const updateRun = (id: string, patch: Partial<QtlRun>) =>
    onChange({
      ...state,
      qtlRuns: state.qtlRuns.map((run) =>
        run.id === id ? { ...run, ...patch } : run,
      ),
    });

  const removeRun = (id: string) =>
    onChange({
      ...state,
      qtlRuns: state.qtlRuns.filter((run) => run.id !== id),
    });

  const totalFeet = state.qtlRuns.reduce((sum, run) => sum + run.lengthFt, 0);
  const totalWatts = state.qtlRuns.reduce((sum, run) => sum + qtlRunPower(run), 0);

  const exportRfq = () =>
    exportCsv("av-sw-qtl-rfq.csv", [
      [
        "Room",
        "Application",
        "Length ft",
        "Available width in",
        "Available depth in",
        "QTL family/profile",
        "W/ft",
        "Calculated load W",
        "Planning driver min W",
        "Voltage",
        "CCT",
        "Environment",
        "Feed",
        "Dimming",
        "Notes",
      ],
      ...state.qtlRuns.map((run) => [
        run.room,
        run.application,
        String(run.lengthFt),
        String(run.widthIn),
        String(run.depthIn),
        run.selectedFamily,
        String(run.wattsPerFt),
        String(qtlRunPower(run)),
        String(qtlDriverMinimum(run)),
        String(run.voltage),
        run.cct,
        run.environment,
        run.feed,
        run.dimming,
        run.notes,
      ]),
    ]);

  return (
    <div className="tool-page">
      <div className="tool-page-heading">
        <div>
          <span className="eyebrow">Design Builder</span>
          <h1>QTL Design Studio</h1>
          <p>
            Build each linear-lighting run from actual millwork/cove dimensions,
            calculate load and driver headroom, and create a working quote request.
          </p>
        </div>
        <div className="tool-action-row">
          <button className="primary" onClick={addRun}>+ Add Run</button>
          <button onClick={exportRfq} disabled={!state.qtlRuns.length}>Export RFQ CSV</button>
        </div>
      </div>

      <div className="tool-summary-grid">
        <article><span>Runs</span><strong>{state.qtlRuns.length}</strong></article>
        <article><span>Total length</span><strong>{totalFeet.toFixed(1)} ft</strong></article>
        <article><span>Calculated load</span><strong>{totalWatts.toFixed(1)} W</strong></article>
        <article><span>Quote prep</span><strong>{state.qtlRuns.length ? "In progress" : "Not started"}</strong></article>
      </div>

      {!state.qtlRuns.length && (
        <div className="tool-empty">
          Add a run for millwork, cove, shelf, toe-kick, wall, or another linear-lighting application.
        </div>
      )}

      <div className="builder-list">
        {state.qtlRuns.map((run, index) => {
          const warnings = qtlRunWarnings(run);
          return (
            <article className="builder-card" key={run.id}>
              <div className="builder-card-header">
                <div>
                  <span className="eyebrow">Run {index + 1}</span>
                  <h3>{run.room || "Unassigned location"}</h3>
                </div>
                <button onClick={() => removeRun(run.id)}>Remove</button>
              </div>

              <div className="builder-form-grid three">
                <label className="field">
                  <span>Room / location</span>
                  <input value={run.room} onChange={(e) => updateRun(run.id, { room: e.target.value })} />
                </label>
                <label className="field">
                  <span>Application</span>
                  <select value={run.application} onChange={(e) => updateRun(run.id, { application: e.target.value as QtlRun["application"] })}>
                    {["Cove","Millwork","Shelf","Toe Kick","Wall","Other"].map((v) => <option key={v}>{v}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>QTL family / profile</span>
                  <input value={run.selectedFamily} onChange={(e) => updateRun(run.id, { selectedFamily: e.target.value })} />
                </label>
                <label className="field">
                  <span>Length (ft)</span>
                  <input type="number" min="0" step="0.1" value={run.lengthFt} onChange={(e) => updateRun(run.id, { lengthFt: numberValue(e.target.value) })} />
                </label>
                <label className="field">
                  <span>Available width (in)</span>
                  <input type="number" min="0" step="0.125" value={run.widthIn} onChange={(e) => updateRun(run.id, { widthIn: numberValue(e.target.value) })} />
                </label>
                <label className="field">
                  <span>Available depth (in)</span>
                  <input type="number" min="0" step="0.125" value={run.depthIn} onChange={(e) => updateRun(run.id, { depthIn: numberValue(e.target.value) })} />
                </label>
                <label className="field">
                  <span>Watts / ft</span>
                  <input type="number" min="0" step="0.1" value={run.wattsPerFt} onChange={(e) => updateRun(run.id, { wattsPerFt: numberValue(e.target.value) })} />
                </label>
                <label className="field">
                  <span>Voltage</span>
                  <select value={run.voltage} onChange={(e) => updateRun(run.id, { voltage: Number(e.target.value) as 24 | 48 })}>
                    <option value={24}>24 V</option>
                    <option value={48}>48 V</option>
                  </select>
                </label>
                <label className="field">
                  <span>CCT</span>
                  <select value={run.cct} onChange={(e) => updateRun(run.id, { cct: e.target.value as QtlRun["cct"] })}>
                    {["2700K","3000K","3500K","4000K","TBD"].map((v) => <option key={v}>{v}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>Environment</span>
                  <select value={run.environment} onChange={(e) => updateRun(run.id, { environment: e.target.value as QtlRun["environment"] })}>
                    {["Dry","Damp","Wet"].map((v) => <option key={v}>{v}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>Feed</span>
                  <select value={run.feed} onChange={(e) => updateRun(run.id, { feed: e.target.value as QtlRun["feed"] })}>
                    {["Left","Right","Center","TBD"].map((v) => <option key={v}>{v}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>Dimming</span>
                  <select value={run.dimming} onChange={(e) => updateRun(run.id, { dimming: e.target.value as QtlRun["dimming"] })}>
                    {["Phase","0-10V","DALI","DMX","On/Off","TBD"].map((v) => <option key={v}>{v}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>Driver reserve %</span>
                  <input type="number" min="0" step="1" value={run.reservePct} onChange={(e) => updateRun(run.id, { reservePct: numberValue(e.target.value) })} />
                </label>
                <label className="field">
                  <span>Manufacturer max run ft</span>
                  <input type="number" min="0" step="0.1" value={run.maxRunFt} onChange={(e) => updateRun(run.id, { maxRunFt: numberValue(e.target.value) })} />
                </label>
              </div>

              <div className="calculation-strip">
                <div><span>Load</span><strong>{qtlRunPower(run).toFixed(1)} W</strong></div>
                <div><span>Planning driver min.</span><strong>{qtlDriverMinimum(run)} W</strong></div>
                <div><span>Reserve</span><strong>{run.reservePct}%</strong></div>
              </div>

              <label className="field">
                <span>Notes / millwork details</span>
                <textarea rows={2} value={run.notes} onChange={(e) => updateRun(run.id, { notes: e.target.value })} />
              </label>

              {!!warnings.length && (
                <div className="warning-list">
                  {warnings.map((warning) => <p key={warning}>⚠ {warning}</p>)}
                </div>
              )}

              <p className="tool-footnote">
                Planning calculations only. Exact family, maximum length, driver and control compatibility still require current QTL documentation/quote verification.
              </p>
            </article>
          );
        })}
      </div>
    </div>
  );
}
