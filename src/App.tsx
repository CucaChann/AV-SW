import { isTauri } from "@tauri-apps/api/core";
import { useEffect, useMemo, useState } from "react";
import DrawingViewer from "./components/DrawingViewer";
import Inspector from "./components/Inspector";
import ProjectToolsWorkspace from "./components/ProjectToolsWorkspace";
import type {
  DrawingAnalysis,
  DraftRecommendation,
} from "./lib/dxf";
import {
  applyRetrofitSurvey,
  DEFAULT_RETROFIT_SURVEY,
  generatePreliminaryBom,
  SYSTEMS,
  type InspectorView,
  type ProjectMode,
  type RetrofitSurvey,
  type SystemName,
} from "./lib/design";
import {
  DEFAULT_TOOLS_STATE,
  type ProjectTool,
  type ProjectToolsState,
} from "./lib/projectTools";
import {
  initializePersistence,
  type PersistenceStatus,
} from "./lib/persistence";
import { useTheme, type ThemePreference } from "./lib/theme";

const SURVEY_STORAGE_KEY = "avsw-retrofit-survey";
const TOOLS_STORAGE_KEY = "avsw-project-tools";

function loadSurvey(): RetrofitSurvey {
  try {
    const stored = localStorage.getItem(SURVEY_STORAGE_KEY);
    if (!stored) return DEFAULT_RETROFIT_SURVEY;

    return {
      ...DEFAULT_RETROFIT_SURVEY,
      ...(JSON.parse(stored) as Partial<RetrofitSurvey>),
    };
  } catch {
    return DEFAULT_RETROFIT_SURVEY;
  }
}

function loadTools(): ProjectToolsState {
  try {
    const stored = localStorage.getItem(TOOLS_STORAGE_KEY);
    if (!stored) return DEFAULT_TOOLS_STATE;

    const parsed = JSON.parse(stored) as Partial<ProjectToolsState>;
    return {
      ...DEFAULT_TOOLS_STATE,
      ...parsed,
      network: {
        ...DEFAULT_TOOLS_STATE.network,
        ...(parsed.network ?? {}),
      },
      budget: {
        ...DEFAULT_TOOLS_STATE.budget,
        ...(parsed.budget ?? {}),
        allocations: {
          ...DEFAULT_TOOLS_STATE.budget.allocations,
          ...(parsed.budget?.allocations ?? {}),
        },
      },
      qtlRuns: parsed.qtlRuns ?? [],
      audioZones: parsed.audioZones ?? [],
      videoChains: parsed.videoChains ?? [],
      cableRuns: parsed.cableRuns ?? [],
    };
  } catch {
    return DEFAULT_TOOLS_STATE;
  }
}

const PROJECT_TOOLS: Array<{ id: ProjectTool; label: string }> = [
  { id: "qtl", label: "QTL Studio" },
  { id: "network", label: "Network Builder" },
  { id: "audio", label: "Audio Zones" },
  { id: "video", label: "Video Chain" },
  { id: "cabling", label: "Cabling" },
  { id: "budget", label: "Budget" },
  { id: "library", label: "Library" },
  { id: "validate", label: "Validate" },
];

export default function App() {
  const desktop = isTauri();
  const theme = useTheme();

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
  const [retrofitSurvey, setRetrofitSurvey] =
    useState<RetrofitSurvey>(loadSurvey);
  const [projectTools, setProjectTools] =
    useState<ProjectToolsState>(loadTools);
  const [activeTool, setActiveTool] =
    useState<ProjectTool | null>(null);

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

  useEffect(() => {
    localStorage.setItem(
      SURVEY_STORAGE_KEY,
      JSON.stringify(retrofitSurvey),
    );
  }, [retrofitSurvey]);

  useEffect(() => {
    localStorage.setItem(
      TOOLS_STORAGE_KEY,
      JSON.stringify(projectTools),
    );
  }, [projectTools]);

  const baseBom = useMemo(
    () => generatePreliminaryBom(analysis, draft, projectMode),
    [analysis, draft, projectMode],
  );

  const bom = useMemo(
    () =>
      projectMode === "retrofit"
        ? applyRetrofitSurvey(baseBom, retrofitSurvey)
        : baseBom,
    [baseBom, projectMode, retrofitSurvey],
  );

  function chooseSystem(system: SystemName) {
    setActiveTool(null);
    setActiveSystem(system);
    setInspectorView("system");
  }

  function setMode(mode: ProjectMode) {
    setActiveTool(null);
    setProjectMode(mode);
    setInspectorView(mode === "retrofit" ? "survey" : "system");
  }

  function openInspector(view: InspectorView) {
    setActiveTool(null);
    setInspectorView(view);
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

          <label
            className="theme-control"
            title={`Theme: ${theme.preference} (${theme.resolved})`}
          >
            <span>Theme</span>
            <select
              value={theme.preference}
              onChange={(event) =>
                theme.setPreference(event.target.value as ThemePreference)
              }
            >
              <option value="system">System</option>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </label>

          {projectMode === "retrofit" && (
            <button onClick={() => openInspector("survey")}>
              Existing Conditions
            </button>
          )}

          <button onClick={() => openInspector("bom")}>
            BOM ({bom.length})
          </button>

          <button
            className="primary"
            onClick={() => setActiveTool("validate")}
          >
            Validate Project
          </button>
        </div>
      </header>

      <section className={`workspace ${activeTool ? "tools-open" : ""}`}>
        <aside className="sidebar">
          <h2>Systems</h2>

          <nav className="system-list">
            {SYSTEMS.map((system) => (
              <button
                className={!activeTool && activeSystem === system.name ? "active" : ""}
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

          <div className="sidebar-section project-tools-section">
            <h3>Project Tools</h3>
            <p className="sidebar-note">
              Functional builders for QTL, network, audio, video, cabling, budget and validation.
            </p>
            <div className="project-tool-list">
              {PROJECT_TOOLS.map((tool) => (
                <button
                  key={tool.id}
                  className={activeTool === tool.id ? "active" : ""}
                  onClick={() => setActiveTool(tool.id)}
                >
                  {tool.label}
                </button>
              ))}
            </div>
          </div>

          <div className="sidebar-section">
            <h3>Project Mode</h3>
            <div className="mode-toggle">
              <button
                className={projectMode === "new-build" ? "active" : ""}
                onClick={() => setMode("new-build")}
              >
                New Build
              </button>
              <button
                className={projectMode === "retrofit" ? "active" : ""}
                onClick={() => setMode("retrofit")}
              >
                Retrofit
              </button>
            </div>

            <p className="sidebar-note">
              {projectMode === "retrofit"
                ? "Survey what exists, preserve compatible infrastructure, and generate a delta scope."
                : "Assume new system design until existing conditions are explicitly marked for reuse."}
            </p>

            {projectMode === "retrofit" && (
              <button
                className="survey-shortcut"
                onClick={() => openInspector("survey")}
              >
                Edit Existing Conditions
              </button>
            )}
          </div>

          <div className="sidebar-section">
            <h3>Drawing</h3>
            <button
              onClick={() => {
                setActiveTool(null);
                window.dispatchEvent(new CustomEvent("avsw:open-floorplan"));
              }}
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

        {activeTool ? (
          <ProjectToolsWorkspace
            activeTool={activeTool}
            onToolChange={setActiveTool}
            onClose={() => setActiveTool(null)}
            state={projectTools}
            onStateChange={setProjectTools}
            bom={bom}
            mode={projectMode}
            survey={retrofitSurvey}
          />
        ) : (
          <>
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
              survey={retrofitSurvey}
              onSurveyChange={setRetrofitSurvey}
              view={inspectorView}
              onViewChange={setInspectorView}
            />
          </>
        )}
      </section>
    </main>
  );
}
