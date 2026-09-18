import { useState } from "react";
import {
  exportCsv,
  newQtlRun,
  qtlRunPower,
  qtlRunWarnings,
  type ProjectToolsState,
  type QtlRun,
} from "../../lib/projectTools";
import {
  QTL_FAMILY_OVERVIEW,
  QTL_FIXTURES,
  QTL_POWER_SUPPLIES,
  QTL_PRESETS,
  qtlCandidatePowerSupply,
  qtlFixtureById,
  qtlPowerSupplyById,
  type QtlPreset,
} from "../../lib/qtlCatalog";

type Props = {
  state: ProjectToolsState;
  onChange: (state: ProjectToolsState) => void;
};

type QtlView = "runs" | "products" | "power";

function numberValue(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizedRun(run: QtlRun): QtlRun {
  return {
    ...run,
    productId: run.productId ?? "",
    fixtureQty: run.fixtureQty ?? 1,
    lens: run.lens ?? "TBD",
    powerSupplyFamilyId: run.powerSupplyFamilyId ?? "qz",
    reservePct: run.reservePct ?? 0,
  };
}

export default function QtlStudio({ state, onChange }: Props) {
  const [view, setView] = useState<QtlView>("runs");

  const addRun = () =>
    onChange({ ...state, qtlRuns: [...state.qtlRuns, newQtlRun()] });

  const addPreset = (preset: QtlPreset) => {
    const base = newQtlRun();
    const product = qtlFixtureById(preset.productId);

    const next: QtlRun = {
      ...base,
      application: preset.application,
      productId: preset.productId,
      selectedFamily: product?.name ?? preset.productId,
      wattsPerFt: preset.wattsPerFt,
      cct: preset.cct,
      environment: preset.environment,
      lens: preset.lens,
      dimming: preset.dimming,
      powerSupplyFamilyId: preset.powerSupplyFamilyId,
      maxRunFt: product?.maxLengthIn ? product.maxLengthIn / 12 : 0,
      notes: preset.note,
    };

    onChange({ ...state, qtlRuns: [...state.qtlRuns, next] });
    setView("runs");
  };

  const updateRun = (id: string, patch: Partial<QtlRun>) =>
    onChange({
      ...state,
      qtlRuns: state.qtlRuns.map((raw) => {
        const run = normalizedRun(raw);
        return run.id === id ? { ...run, ...patch } : run;
      }),
    });

  const removeRun = (id: string) =>
    onChange({
      ...state,
      qtlRuns: state.qtlRuns.filter((run) => run.id !== id),
    });

  const selectProduct = (run: QtlRun, productId: string) => {
    const product = qtlFixtureById(productId);
    if (!product) {
      updateRun(run.id, {
        productId: "",
        selectedFamily: "TBD / Select from QTL library",
      });
      return;
    }

    updateRun(run.id, {
      productId,
      selectedFamily: product.name,
      wattsPerFt: product.wattagesPerFt?.[0] ?? run.wattsPerFt,
      cct: product.ccts?.includes(run.cct)
        ? run.cct
        : product.ccts?.find((value) => value === "3000K") ?? product.ccts?.[0] ?? run.cct,
      lens: product.lenses?.[0] ?? run.lens,
      maxRunFt: product.maxLengthIn ? product.maxLengthIn / 12 : 0,
    });
  };

  const totalFeet = state.qtlRuns.reduce(
    (sum, raw) => {
      const run = normalizedRun(raw);
      return sum + run.lengthFt * Math.max(1, run.fixtureQty);
    },
    0,
  );
  const totalWatts = state.qtlRuns.reduce(
    (sum, raw) => sum + qtlRunPower(normalizedRun(raw)),
    0,
  );

  const exportRfq = () =>
    exportCsv("av-sw-qtl-rfq.csv", [
      [
        "Room / Location",
        "Application",
        "Fixture Qty",
        "QTL Product",
        "Length Each ft",
        "Total Fixture ft",
        "Available Width in",
        "Available Depth in",
        "W/ft",
        "Calculated Connected Load W",
        "Voltage",
        "CCT",
        "Environment",
        "Lens / Optic",
        "Feed",
        "Control / Dimming",
        "PSU Family",
        "Planning PSU Candidate",
        "Notes",
      ],
      ...state.qtlRuns.map((raw) => {
        const run = normalizedRun(raw);
        const candidate = qtlCandidatePowerSupply(
          run.powerSupplyFamilyId,
          qtlRunPower(run),
        );
        return [
          run.room,
          run.application,
          String(run.fixtureQty),
          run.selectedFamily,
          String(run.lengthFt),
          String(run.lengthFt * run.fixtureQty),
          String(run.widthIn),
          String(run.depthIn),
          String(run.wattsPerFt),
          String(qtlRunPower(run)),
          String(run.voltage),
          run.cct,
          run.environment,
          run.lens,
          run.feed,
          run.dimming,
          candidate?.family.name ?? run.powerSupplyFamilyId,
          candidate?.wattage ? `${candidate.wattage}W capacity candidate` : "Engineering / quote review",
          run.notes,
        ];
      }),
    ]);

  return (
    <div className="tool-page qtl-studio">
      <div className="tool-page-heading">
        <div>
          <span className="eyebrow">QTL / Q-Tran Design Builder</span>
          <h1>QTL Design Studio</h1>
          <p>
            Configure the actual fixture, run geometry, environment, light engine,
            control and QTL power-supply family — then turn the design into a quote-ready schedule.
          </p>
        </div>
        <div className="tool-action-row">
          <button className="primary" onClick={addRun}>+ Blank Run</button>
          <button onClick={exportRfq} disabled={!state.qtlRuns.length}>Export RFQ CSV</button>
        </div>
      </div>

      <div className="qtl-tabs">
        <button className={view === "runs" ? "active" : ""} onClick={() => setView("runs")}>Runs + RFQ</button>
        <button className={view === "products" ? "active" : ""} onClick={() => setView("products")}>Product Guide</button>
        <button className={view === "power" ? "active" : ""} onClick={() => setView("power")}>Power Supplies</button>
      </div>

      {view === "runs" && (
        <>
          <div className="tool-summary-grid">
            <article><span>Configured lines</span><strong>{state.qtlRuns.length}</strong></article>
            <article><span>Total fixture length</span><strong>{totalFeet.toFixed(1)} ft</strong></article>
            <article><span>Connected load</span><strong>{totalWatts.toFixed(1)} W</strong></article>
            <article><span>RFQ status</span><strong>{state.qtlRuns.length ? "Working" : "Not started"}</strong></article>
          </div>

          <section className="builder-card qtl-presets">
            <div className="builder-card-header">
              <div>
                <h3>Fast-start application patterns</h3>
                <p className="muted">
                  These presets are based on the structure of a real QTL quote you supplied,
                  then mapped to the current QTL catalog. They are starting points, not final orders.
                </p>
              </div>
              <span className="badge">Quote-informed</span>
            </div>
            <div className="qtl-preset-grid">
              {QTL_PRESETS.map((preset) => (
                <button key={preset.id} onClick={() => addPreset(preset)}>
                  <strong>{preset.label}</strong>
                  <span>{preset.wattsPerFt} W/ft · {preset.cct} · {preset.environment}</span>
                </button>
              ))}
            </div>
          </section>

          {!state.qtlRuns.length && (
            <div className="tool-empty">
              Start with a quote-informed pattern above or add a blank QTL run.
            </div>
          )}

          <div className="builder-list">
            {state.qtlRuns.map((raw, index) => {
              const run = normalizedRun(raw);
              const product = qtlFixtureById(run.productId);
              const psu = qtlPowerSupplyById(run.powerSupplyFamilyId);
              const candidate = qtlCandidatePowerSupply(
                run.powerSupplyFamilyId,
                qtlRunPower(run),
              );
              const warnings = qtlRunWarnings(run);

              if (product?.maxLengthIn && run.lengthFt * 12 > product.maxLengthIn) {
                warnings.push(
                  `Entered fixture length exceeds the current catalog max of ${product.maxLengthIn}" for this product; split/segment or confirm with QTL.`,
                );
              }

              return (
                <article className="builder-card qtl-run-card" key={run.id}>
                  <div className="builder-card-header">
                    <div>
                      <span className="eyebrow">QTL Line {index + 1}</span>
                      <h3>{run.room || "Unassigned location"}</h3>
                    </div>
                    <button onClick={() => removeRun(run.id)}>Remove</button>
                  </div>

                  <div className="qtl-flow">
                    <div className="qtl-flow-node">
                      <span>APPLICATION</span>
                      <strong>{run.application || "TBD"}</strong>
                      <small>{run.room || "Location TBD"}</small>
                    </div>
                    <div className="qtl-flow-arrow">→</div>
                    <div className="qtl-flow-node fixture">
                      <span>FIXTURE</span>
                      <strong>{product?.name ?? run.selectedFamily}</strong>
                      <small>{run.fixtureQty} × {run.lengthFt.toFixed(2)} ft</small>
                    </div>
                    <div className="qtl-flow-arrow">→</div>
                    <div className="qtl-flow-node load">
                      <span>CONNECTED LOAD</span>
                      <strong>{qtlRunPower(run).toFixed(1)} W</strong>
                      <small>{run.wattsPerFt} W/ft</small>
                    </div>
                    <div className="qtl-flow-arrow">→</div>
                    <div className="qtl-flow-node psu">
                      <span>POWER</span>
                      <strong>{psu?.name ?? "PSU TBD"}</strong>
                      <small>{candidate?.wattage ? `${candidate.wattage}W capacity candidate` : "Engineering review"}</small>
                    </div>
                  </div>

                  <div className="builder-form-grid three">
                    <label className="field">
                      <span>Room / location</span>
                      <input value={run.room} onChange={(e) => updateRun(run.id, { room: e.target.value })} />
                    </label>

                    <label className="field">
                      <span>Application</span>
                      <input value={run.application} onChange={(e) => updateRun(run.id, { application: e.target.value })} />
                    </label>

                    <label className="field">
                      <span>QTL product</span>
                      <select value={run.productId} onChange={(e) => selectProduct(run, e.target.value)}>
                        <option value="">TBD / Custom</option>
                        {QTL_FIXTURES.map((item) => (
                          <option key={item.id} value={item.id}>{item.name}</option>
                        ))}
                      </select>
                    </label>

                    <label className="field">
                      <span>Fixture quantity</span>
                      <input type="number" min="1" step="1" value={run.fixtureQty} onChange={(e) => updateRun(run.id, { fixtureQty: Math.max(1, numberValue(e.target.value)) })} />
                    </label>

                    <label className="field">
                      <span>Length each (ft)</span>
                      <input type="number" min="0" step="0.01" value={run.lengthFt} onChange={(e) => updateRun(run.id, { lengthFt: numberValue(e.target.value) })} />
                    </label>

                    <label className="field">
                      <span>Watts / ft</span>
                      <select
                        value={run.wattsPerFt}
                        onChange={(e) => updateRun(run.id, { wattsPerFt: numberValue(e.target.value) })}
                      >
                        {product?.wattagesPerFt?.map((wattage) => <option value={wattage} key={wattage}>{wattage} W/ft</option>)}
                        {!product?.wattagesPerFt?.includes(run.wattsPerFt) && <option value={run.wattsPerFt}>{run.wattsPerFt} W/ft</option>}
                      </select>
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
                      <span>CCT</span>
                      <select value={run.cct} onChange={(e) => updateRun(run.id, { cct: e.target.value })}>
                        {(product?.ccts?.length ? product.ccts : ["2200K","2400K","2700K","3000K","3500K","4000K","TBD"]).map((value) => <option key={value}>{value}</option>)}
                      </select>
                    </label>

                    <label className="field">
                      <span>Environment</span>
                      <select value={run.environment} onChange={(e) => updateRun(run.id, { environment: e.target.value as QtlRun["environment"] })}>
                        {["Dry","Damp","Wet"].map((value) => <option key={value}>{value}</option>)}
                      </select>
                    </label>

                    <label className="field">
                      <span>Lens / optic</span>
                      <select value={run.lens} onChange={(e) => updateRun(run.id, { lens: e.target.value })}>
                        {(product?.lenses?.length ? product.lenses : ["Diffused","Frosted","Optical","Encapsulated Clear","Encapsulated Translucent","TBD"]).map((value) => <option key={value}>{value}</option>)}
                        {!product?.lenses?.includes(run.lens) && <option value={run.lens}>{run.lens}</option>}
                      </select>
                    </label>

                    <label className="field">
                      <span>Feed</span>
                      <select value={run.feed} onChange={(e) => updateRun(run.id, { feed: e.target.value as QtlRun["feed"] })}>
                        {["Left","Right","Center","TBD"].map((value) => <option key={value}>{value}</option>)}
                      </select>
                    </label>

                    <label className="field">
                      <span>Control / dimming</span>
                      <input value={run.dimming} onChange={(e) => updateRun(run.id, { dimming: e.target.value })} />
                    </label>

                    <label className="field">
                      <span>Power-supply family</span>
                      <select value={run.powerSupplyFamilyId} onChange={(e) => updateRun(run.id, { powerSupplyFamilyId: e.target.value })}>
                        {QTL_POWER_SUPPLIES.map((item) => (
                          <option key={item.id} value={item.id}>{item.name}</option>
                        ))}
                      </select>
                    </label>

                    <label className="field">
                      <span>Optional design reserve %</span>
                      <input type="number" min="0" step="1" value={run.reservePct} onChange={(e) => updateRun(run.id, { reservePct: numberValue(e.target.value) })} />
                    </label>
                  </div>

                  <div className="calculation-strip qtl-calcs">
                    <div><span>Fixture length total</span><strong>{(run.lengthFt * run.fixtureQty).toFixed(2)} ft</strong></div>
                    <div><span>Connected load</span><strong>{qtlRunPower(run).toFixed(1)} W</strong></div>
                    <div><span>PSU family</span><strong>{psu?.name ?? "TBD"}</strong></div>
                    <div><span>Capacity candidate</span><strong>{candidate?.wattage ? `${candidate.wattage} W` : "Review"}</strong></div>
                  </div>

                  {product && (
                    <div className="qtl-source-row">
                      <div>
                        <strong>{product.name}</strong>
                        <span>{product.notes}</span>
                      </div>
                      <a href={product.officialUrl} target="_blank" rel="noreferrer">Official QTL page ↗</a>
                    </div>
                  )}

                  {psu && (
                    <div className="qtl-source-row psu-source">
                      <div>
                        <strong>{psu.name}</strong>
                        <span>{psu.currentUse}</span>
                      </div>
                      <a href={psu.officialUrl} target="_blank" rel="noreferrer">Power docs ↗</a>
                    </div>
                  )}

                  <label className="field">
                    <span>Notes / millwork / installation detail</span>
                    <textarea rows={2} value={run.notes} onChange={(e) => updateRun(run.id, { notes: e.target.value })} />
                  </label>

                  {!!warnings.length && (
                    <div className="warning-list">
                      {warnings.map((warning) => <p key={warning}>⚠ {warning}</p>)}
                    </div>
                  )}

                  <p className="tool-footnote">
                    PSU capacity matching is a planning aid only. QTL quote examples show that actual PSU selection depends on fixture grouping,
                    output/channel architecture, environment, control protocol and the exact QTL ordering configuration — not wattage alone.
                  </p>
                </article>
              );
            })}
          </div>
        </>
      )}

      {view === "products" && (
        <>
          <section className="builder-card">
            <div className="builder-card-header">
              <div>
                <h3>QTL family map</h3>
                <p className="muted">A compact way for a PM to understand which family to look at before opening a spec sheet.</p>
              </div>
              <span className="badge">{QTL_FAMILY_OVERVIEW.length} families</span>
            </div>
            <div className="qtl-family-grid">
              {QTL_FAMILY_OVERVIEW.map((family) => (
                <article key={family.family}>
                  <strong>{family.family}</strong>
                  <p>{family.summary}</p>
                  <div className="chip-list">
                    {family.members.map((member) => <span className="chip" key={member}>{member}</span>)}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <div className="qtl-product-grid">
            {QTL_FIXTURES.map((product) => (
              <article className="builder-card qtl-product-card" key={product.id}>
                <div className="qtl-product-visual" aria-hidden="true">
                  <span className={product.category.includes("Flexible") ? "qtl-line flexible" : "qtl-line"} />
                  <span className="qtl-light-beam" />
                </div>
                <span className="eyebrow">{product.family} · {product.category}</span>
                <h3>{product.name}</h3>
                <p className="muted">{product.notes}</p>
                <div className="chip-list">
                  {product.applications.slice(0, 4).map((application) => <span className="chip" key={application}>{application}</span>)}
                  {product.environments.map((environment) => <span className="chip" key={environment}>{environment}</span>)}
                </div>
                <a className="qtl-doc-link" href={product.officialUrl} target="_blank" rel="noreferrer">Spec / ordering / install / CAD ↗</a>
              </article>
            ))}
          </div>
        </>
      )}

      {view === "power" && (
        <>
          <section className="builder-card">
            <div className="builder-card-header">
              <div>
                <h3>How QTL power fits the design</h3>
                <p className="muted">Select environment + output + control first, then size capacity and exact model.</p>
              </div>
            </div>
            <div className="qtl-power-flow">
              <div><span>120–277V / branch power</span></div>
              <b>→</b>
              <div className="psu-box"><span>QTL PSU / DRIVER</span><small>QZ · QTM · QOM · Q-SET · Q-HEX</small></div>
              <b>→</b>
              <div><span>12/24V fixture load</span></div>
              <b>+</b>
              <div><span>Phase / 0-10V / DALI / DMX / other control</span></div>
            </div>
          </section>

          <div className="qtl-psu-grid">
            {QTL_POWER_SUPPLIES.map((psu) => (
              <article className="builder-card qtl-psu-card" key={psu.id}>
                <div className="qtl-psu-visual">
                  <div className="psu-body">
                    <span>QTL</span>
                    <strong>{psu.name}</strong>
                    <small>{psu.acDc}</small>
                  </div>
                  <div className="psu-terminal">IN</div>
                  <div className="psu-terminal">OUT</div>
                </div>
                <h3>{psu.name}</h3>
                <p className="muted">{psu.currentUse}</p>
                <dl className="qtl-spec-list">
                  <div><dt>Output</dt><dd>{psu.outputVoltages.join(", ")}</dd></div>
                  <div><dt>Capacity</dt><dd>{Math.min(...psu.wattages)}–{Math.max(...psu.wattages)} W family range</dd></div>
                  <div><dt>Control</dt><dd>{psu.controls.join(", ")}</dd></div>
                  <div><dt>Environment</dt><dd>{psu.environments.join(", ")}</dd></div>
                </dl>
                <a className="qtl-doc-link" href={psu.officialUrl} target="_blank" rel="noreferrer">Official power-supply page ↗</a>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
