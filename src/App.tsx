import { isTauri } from "@tauri-apps/api/core";
import { useEffect, useMemo, useState } from "react";
import DrawingViewer from "./components/DrawingViewer";
import Inspector from "./components/Inspector";
import type {
  DrawingAnalysis,
  DraftRecommendation,
} from "./lib/dxf";
import {
  generatePreliminaryBom,
  SYSTEMS,
  type InspectorView,
  type ProjectMode,
  type SystemName,
} from "./lib/design";
import {
  initializePersistence,
  type PersistenceStatus,
} from "./lib/persistence";

export default function App() {
  const desktop = isTauri();
  const [persistence, setPersistence] =
    useState<PersistenceStatus | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<DrawingAnalysis | null>(null);
  const [draft, setDraft] = useState<DraftRecommendation[]>([]);
  const [activeSystem, setActiveSystem] =
    useState<SystemName>("Lighting");
  const [projectMode, setProjectMode] =
    useState<ProjectMode>("new-build");
  const [inspectorView, setInspectorView] =
    useState<InspectorView>("system");

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

  const bom = useMemo(
    () => generatePreliminaryBom(analysis, draft, projectMode),
    [analysis, draft, projectMode],
  );

  function chooseSystem(system: SystemName) {
    setActiveSystem(system);
    setInspectorView("system");
  }

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
          <button onClick={() => setInspectorView("bom")}>
            BOM ({bom.length})
          </button>
          <button className="primary">Design Check</button>
        </div>
      </header>

      <section className="workspace">
        <aside className="sidebar">
          <h2>Systems</h2>

          <nav className="system-list">
            {SYSTEMS.map((system) => (
              <button
                className={activeSystem === system.name ? "active" : ""}
                key={system.name}
                onClick={() => chooseSystem(system.name)}
              >
                <span>{system.name}</span>
                <span className="system-count">
                  {bom.filter((item) => item.system === system.name).length}
                </span>
              </button>
            ))}
          </nav>

          <div className="sidebar-section">
            <h3>Project Mode</h3>
            <div className="mode-toggle">
              <button
                className={projectMode === "new-build" ? "active" : ""}
                onClick={() => setProjectMode("new-build")}
              >
                New Build
              </button>
              <button
                className={projectMode === "retrofit" ? "active" : ""}
                onClick={() => setProjectMode("retrofit")}
              >
                Retrofit
              </button>
            </div>
            <p className="sidebar-note">
              {projectMode === "retrofit"
                ? "Preserve compatible infrastructure first; replace only what blocks the upgrade."
                : "Assume new system design until existing conditions are explicitly marked for reuse."}
            </p>
          </div>

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

        <Inspector
          activeSystem={activeSystem}
          mode={projectMode}
          analysis={analysis}
          draft={draft}
          bom={bom}
          view={inspectorView}
          onViewChange={setInspectorView}
        />
      </section>
    </main>
  );
}
