import { isTauri } from "@tauri-apps/api/core";
import { useEffect, useMemo, useState } from "react";
import DrawingViewer from "./components/DrawingViewer";
import type {
  DrawingAnalysis,
  DraftRecommendation,
} from "./lib/dxf";
import {
  initializePersistence,
  type PersistenceStatus,
} from "./lib/persistence";

const systems = [
  "Lighting",
  "Lutron",
  "QTL",
  "Shades",
  "Network",
  "Audio",
  "Video",
  "Infrastructure",
];

export default function App() {
  const desktop = isTauri();
  const [persistence, setPersistence] =
    useState<PersistenceStatus | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<DrawingAnalysis | null>(null);
  const [draft, setDraft] = useState<DraftRecommendation[]>([]);

  useEffect(() => {
    void initializePersistence()
      .then(setPersistence)
      .catch((error: unknown) => {
        setStorageError(
          error instanceof Error
            ? error.message
            : "Storage initialization failed",
        );
      });
  }, []);

  const draftBySystem = useMemo(() => {
    const groups = new Map<string, DraftRecommendation[]>();

    for (const recommendation of draft) {
      const existing = groups.get(recommendation.system) ?? [];
      existing.push(recommendation);
      groups.set(recommendation.system, existing);
    }

    return Array.from(groups.entries());
  }, [draft]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <strong>AV-SW</strong>
          <span className="muted">Design Workspace</span>
          <span className={`runtime-badge ${desktop ? "desktop" : "browser"}`}>
            {desktop ? "Desktop" : "Browser Dev"}
          </span>
        </div>

        <div className="top-actions">
          <button>Project: Demo</button>
          <button>Revision: P1</button>
          <button className="primary">Design Check</button>
        </div>
      </header>

      <section className="workspace">
        <aside className="sidebar">
          <h2>Systems</h2>

          <nav className="system-list">
            {systems.map((system) => (
              <button key={system}>{system}</button>
            ))}
          </nav>

          <div className="sidebar-section">
            <h3>Tools</h3>
            <button
              onClick={() =>
                window.dispatchEvent(new CustomEvent("avsw:open-floorplan"))
              }
            >
              Open Drawing
            </button>
            <button disabled>Measure</button>
            <button disabled>Draw Room</button>
            <button disabled>Place Device</button>
          </div>

          <div className="sidebar-section">
            <h3>Local Storage</h3>
            <p className="sidebar-note">
              {storageError
                ? `Error: ${storageError}`
                : persistence?.label ?? "Starting…"}
            </p>
          </div>
        </aside>

        <DrawingViewer
          onAnalysisChange={setAnalysis}
          onDraftChange={setDraft}
        />

        <aside className="inspector">
          <h2>Properties</h2>

          {!analysis && (
            <div className="empty-state">
              <p>
                Open a DXF to inspect layers, geometry, detected room labels,
                and first-draft recommendations.
              </p>
            </div>
          )}

          {analysis && (
            <div className="analysis-panel">
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
                    {analysis.potentialRooms.slice(0, 14).map((room, index) => (
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
                    {analysis.layers.slice(0, 10).map((layer) => (
                      <div className="layer-row" key={layer.name}>
                        <span title={layer.name}>{layer.name}</span>
                        <strong>{layer.entityCount}</strong>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <div className="issues">
            <div className="panel-heading">
              <h3>First Draft</h3>
              <span className="badge">{draft.length}</span>
            </div>

            {draft.length === 0 ? (
              <p className="muted">
                For DXF drawings, click Generate First Draft after import.
              </p>
            ) : (
              <div className="draft-list">
                {draftBySystem.map(([system, recommendations]) => (
                  <section className="draft-group" key={system}>
                    <h4>{system}</h4>
                    {recommendations.map((recommendation) => (
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
                          <span className="room-label">
                            {recommendation.room}
                          </span>
                        )}
                        <p>{recommendation.rationale}</p>
                      </article>
                    ))}
                  </section>
                ))}
              </div>
            )}
          </div>

          <div className="issues">
            <div className="panel-heading">
              <h3>Design Issues</h3>
              <span className="badge">0</span>
            </div>
            <p className="muted">No issues yet.</p>
          </div>

          <div className="issues">
            <div className="panel-heading">
              <h3>Architecture</h3>
              <span className="badge">Hybrid</span>
            </div>
            <p className="muted">
              Local-first project data with a cloud-backed product library
              planned for later milestones.
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}
