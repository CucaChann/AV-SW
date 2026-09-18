import { useMemo, useState } from "react";
import type {
  DrawingAnalysis,
  DraftRecommendation,
} from "../lib/dxf";
import {
  getSystemDefinition,
  type BomItem,
  type InspectorView,
  type ProjectMode,
  type SystemName,
} from "../lib/design";

type Props = {
  activeSystem: SystemName;
  mode: ProjectMode;
  analysis: DrawingAnalysis | null;
  draft: DraftRecommendation[];
  bom: BomItem[];
  view: InspectorView;
  onViewChange: (view: InspectorView) => void;
};

function BomRows({ items }: { items: BomItem[] }) {
  if (items.length === 0) {
    return <p className="muted">No preliminary BOM items yet.</p>;
  }

  return (
    <div className="bom-list">
      {items.map((item) => (
        <article className="bom-card" key={item.id}>
          <div className="bom-card-top">
            <div>
              <strong>{item.item}</strong>
              {item.manufacturer && (
                <span className="bom-manufacturer">{item.manufacturer}</span>
              )}
            </div>
            <span className={`bom-status ${item.status.toLowerCase()}`}>
              {item.status}
            </span>
          </div>

          <div className="bom-meta">
            <span>Qty: {item.quantity}</span>
            <span>{item.confidence}</span>
          </div>

          <p>{item.basis}</p>
        </article>
      ))}
    </div>
  );
}

export default function Inspector({
  activeSystem,
  mode,
  analysis,
  draft,
  bom,
  view,
  onViewChange,
}: Props) {
  const [showAllBom, setShowAllBom] = useState(false);
  const definition = getSystemDefinition(activeSystem);

  const systemDraft = useMemo(
    () => draft.filter((item) => item.system === activeSystem),
    [activeSystem, draft],
  );

  const filteredBom = useMemo(
    () =>
      showAllBom
        ? bom
        : bom.filter((item) => item.system === activeSystem),
    [activeSystem, bom, showAllBom],
  );

  const statusCounts = useMemo(() => {
    const initial = { Add: 0, Replace: 0, Reuse: 0, Verify: 0 };

    for (const item of bom) {
      initial[item.status] += 1;
    }

    return initial;
  }, [bom]);

  return (
    <aside className="inspector">
      <div className="inspector-title-row">
        <div>
          <span className="eyebrow">
            {mode === "retrofit" ? "Retrofit / Upgrade" : "New Build"}
          </span>
          <h2>{activeSystem}</h2>
        </div>
        <span className="badge">{definition.manufacturers.length}</span>
      </div>

      <div className="inspector-tabs">
        <button
          className={view === "system" ? "active" : ""}
          onClick={() => onViewChange("system")}
        >
          System
        </button>
        <button
          className={view === "bom" ? "active" : ""}
          onClick={() => onViewChange("bom")}
        >
          BOM
        </button>
        <button
          className={view === "analysis" ? "active" : ""}
          onClick={() => onViewChange("analysis")}
        >
          Analysis
        </button>
      </div>

      {view === "system" && (
        <>
          <section className="inspector-card">
            <p className="system-summary">{definition.summary}</p>

            <h3>Manufacturer focus</h3>
            <div className="chip-list">
              {definition.manufacturers.map((manufacturer) => (
                <span className="chip" key={manufacturer}>
                  {manufacturer}
                </span>
              ))}
            </div>

            <h3 className="panel-subheading">First design steps</h3>
            <ol className="action-list">
              {definition.firstActions.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ol>
          </section>

          {mode === "retrofit" && (
            <section className="inspector-card retrofit-card">
              <div className="panel-heading">
                <h3>Retrofit strategy</h3>
                <span className="badge">Preserve first</span>
              </div>
              <p className="muted retrofit-intro">
                The goal is not automatically to rip everything out. AV-SW
                should verify what can remain, identify incompatibilities, and
                generate the smallest sensible upgrade scope.
              </p>
              <ul className="retrofit-list">
                {definition.retrofitFocus.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          )}

          <section className="inspector-card">
            <div className="panel-heading">
              <h3>Draft recommendations</h3>
              <span className="badge">{systemDraft.length}</span>
            </div>

            {systemDraft.length === 0 ? (
              <p className="muted">
                Generate the first draft to populate system-specific
                recommendations.
              </p>
            ) : (
              <div className="draft-list compact">
                {systemDraft.map((recommendation) => (
                  <article className="draft-card" key={recommendation.id}>
                    <div className="draft-card-heading">
                      <strong>{recommendation.title}</strong>
                      <span
                        className={`confidence ${recommendation.confidence.toLowerCase()}`}
                      >
                        {recommendation.confidence}
                      </span>
                    </div>
                    {recommendation.room && (
                      <span className="room-label">{recommendation.room}</span>
                    )}
                    <p>{recommendation.rationale}</p>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="inspector-card">
            <div className="panel-heading">
              <h3>Preliminary BOM</h3>
              <span className="badge">
                {bom.filter((item) => item.system === activeSystem).length}
              </span>
            </div>
            <BomRows
              items={bom.filter((item) => item.system === activeSystem)}
            />
          </section>
        </>
      )}

      {view === "bom" && (
        <>
          <section className="inspector-card">
            <div className="panel-heading">
              <div>
                <h3>Preliminary BOM</h3>
                <p className="muted mini-copy">
                  Drawing-derived working scope — not a final purchasing list.
                </p>
              </div>
              <span className="badge">{bom.length}</span>
            </div>

            <div className="bom-summary">
              <span className="bom-status add">Add {statusCounts.Add}</span>
              <span className="bom-status replace">
                Replace {statusCounts.Replace}
              </span>
              <span className="bom-status reuse">Reuse {statusCounts.Reuse}</span>
              <span className="bom-status verify">
                Verify {statusCounts.Verify}
              </span>
            </div>

            <div className="scope-toggle">
              <button
                className={!showAllBom ? "active" : ""}
                onClick={() => setShowAllBom(false)}
              >
                {activeSystem}
              </button>
              <button
                className={showAllBom ? "active" : ""}
                onClick={() => setShowAllBom(true)}
              >
                All Systems
              </button>
            </div>
          </section>

          <section className="inspector-card">
            <BomRows items={filteredBom} />
          </section>

          <section className="inspector-card bom-note">
            <strong>Before ordering</strong>
            <p>
              Exact models and final quantities must come from the approved
              design, load schedule, product compatibility checks, field
              verification, and current manufacturer data.
            </p>
          </section>
        </>
      )}

      {view === "analysis" && (
        <>
          {!analysis && (
            <section className="empty-state">
              <p>
                Open a DXF to inspect layers, geometry, detected room labels,
                and existing-condition clues.
              </p>
            </section>
          )}

          {analysis && (
            <section className="analysis-panel">
              <div className="panel-heading">
                <h3>Drawing Analysis</h3>
                <span className="badge">{analysis.sourceType}</span>
              </div>

              <dl className="analysis-grid">
                <div>
                  <dt>Units</dt>
                  <dd>{analysis.units}</dd>
                </div>
                <div>
                  <dt>Entities</dt>
                  <dd>{analysis.entityCount.toLocaleString()}</dd>
                </div>
                <div>
                  <dt>Layers</dt>
                  <dd>{analysis.layerCount}</dd>
                </div>
                <div>
                  <dt>Potential rooms</dt>
                  <dd>{analysis.potentialRooms.length}</dd>
                </div>
                <div>
                  <dt>Lines</dt>
                  <dd>{analysis.lineCount}</dd>
                </div>
                <div>
                  <dt>Polylines</dt>
                  <dd>{analysis.polylineCount}</dd>
                </div>
                <div>
                  <dt>Dimensions</dt>
                  <dd>{analysis.dimensionCount}</dd>
                </div>
                <div>
                  <dt>Blocks</dt>
                  <dd>{analysis.insertCount}</dd>
                </div>
              </dl>

              <div className="detected-row">
                <span>Wall-like</span>
                <strong>{analysis.wallLikeEntities}</strong>
              </div>
              <div className="detected-row">
                <span>Door-like</span>
                <strong>{analysis.doorLikeEntities}</strong>
              </div>
              <div className="detected-row">
                <span>Window-like</span>
                <strong>{analysis.windowLikeEntities}</strong>
              </div>

              {analysis.potentialRooms.length > 0 && (
                <>
                  <h4 className="panel-subheading">Detected room labels</h4>
                  <div className="chip-list">
                    {analysis.potentialRooms.slice(0, 16).map((room, index) => (
                      <span
                        className="chip"
                        key={`${room.label}-${index}`}
                        title={room.normalizedType}
                      >
                        {room.label}
                      </span>
                    ))}
                  </div>
                </>
              )}

              {analysis.layers.length > 0 && (
                <>
                  <h4 className="panel-subheading">Top layers</h4>
                  <div className="layer-list">
                    {analysis.layers.slice(0, 14).map((layer) => (
                      <div className="layer-row" key={layer.name}>
                        <span title={layer.name}>{layer.name}</span>
                        <strong>{layer.entityCount}</strong>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
          )}
        </>
      )}

      <section className="issues">
        <div className="panel-heading">
          <h3>Design Issues</h3>
          <span className="badge">0</span>
        </div>
        <p className="muted">No blocking issues yet.</p>
      </section>
    </aside>
  );
}
