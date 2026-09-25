import { isTauri } from "@tauri-apps/api/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import packageJson from "../package.json";
import DrawingViewer, { type DesignChange } from "./components/DrawingViewer";
import ErrorBoundary from "./components/ErrorBoundary";
import FileMenu from "./components/FileMenu";
import Inspector from "./components/Inspector";
import ProjectToolsWorkspace from "./components/ProjectToolsWorkspace";
import type { DrawingAnalysis, DraftRecommendation } from "./lib/dxf";
import {
  applyRetrofitSurvey,
  generatePreliminaryBom,
  normalizeSurvey,
  SYSTEMS,
  type InspectorView,
  type ProjectMode,
  type RetrofitSurvey,
  type SystemName,
} from "./lib/design";
import {
  generateToolBom,
  normalizeTools,
  validateProject,
  type ProjectTool,
  type ProjectToolsState,
} from "./lib/projectTools";
import { designBom, effectiveScale, mergeDesignBom } from "./lib/designBom";
import { initializePersistence } from "./lib/persistence";
import {
  moveDesignToDrawing,
  removeDrawingFromDesign,
  type PlanDesign,
  type PlanItem,
} from "./lib/planDesign";
import {
  activeDrawing,
  newDrawing,
  newProject,
  parseProjectWithRepairs,
  projectNameFromPath,
  serializeProject,
  type ProjectDocument,
} from "./lib/projectFile";
import {
  askUnsavedChanges,
  askYesNo,
  DRAWING_FILTER,
  pickAndReadFile,
  PROJECT_FILTER,
  readPath,
  saveProjectBytes,
  setWindowTitle,
  showError,
  showWarning,
} from "./lib/projectIO";
import {
  loadRecents,
  storeRecents,
  withoutRecent,
  withRecent,
  type RecentProject,
} from "./lib/recents";
import { clearRecovery, loadRecovery, saveRecovery } from "./lib/recovery";
import { useTheme, type ThemePreference } from "./lib/theme";

const APP_VERSION = packageJson.version;
const RECOVERY_DELAY_MS = 1500;

// Where survey/tool data lived before projects were saved as files. Migrated
// once into the first project, then removed.
const LEGACY_SURVEY_KEY = "avsw-retrofit-survey";
const LEGACY_TOOLS_KEY = "avsw-project-tools";

type Session = {
  project: ProjectDocument;
  /** The .avsw file on disk; null until saved (always null in the browser). */
  path: string | null;
  dirty: boolean;
};

const PROJECT_TOOLS: Array<{ id: ProjectTool; label: string }> = [
  { id: "qtl", label: "QTL Studio" },
  { id: "network", label: "Network Builder" },
  { id: "audio", label: "Audio Zones" },
  { id: "video", label: "Video Chain" },
  { id: "cabling", label: "Cabling" },
  { id: "budget", label: "Budget" },
  { id: "schedule", label: "Device Schedule" },
  { id: "library", label: "Library" },
  { id: "validate", label: "Validate" },
];

function isTypingTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  return Boolean(
    element &&
      (element.tagName === "INPUT" ||
        element.tagName === "TEXTAREA" ||
        element.tagName === "SELECT" ||
        element.isContentEditable),
  );
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function migrateLegacyState(): Session | null {
  try {
    const survey = localStorage.getItem(LEGACY_SURVEY_KEY);
    const tools = localStorage.getItem(LEGACY_TOOLS_KEY);
    if (!survey && !tools) return null;
    const project = newProject();
    return {
      project: {
        ...project,
        survey: normalizeSurvey(survey ? JSON.parse(survey) : undefined),
        tools: normalizeTools(tools ? JSON.parse(tools) : undefined),
      },
      path: null,
      dirty: true,
    };
  } catch {
    return null;
  }
}

function clearLegacyState() {
  try {
    localStorage.removeItem(LEGACY_SURVEY_KEY);
    localStorage.removeItem(LEGACY_TOOLS_KEY);
  } catch {
    // Nothing to clean up.
  }
}

/**
 * Startup: unsaved work from the recovery copy; a saved project is re-read
 * from its file in case it changed on disk; otherwise pre-file data or a new
 * project.
 */
async function restoreSession(): Promise<Session> {
  const recovered = await loadRecovery();
  if (recovered) {
    if (!recovered.dirty && recovered.path && isTauri()) {
      try {
        const file = await readPath(recovered.path);
        const { project, repairs } = parseProjectWithRepairs(file.bytes);
        return {
          project: { ...project, name: projectNameFromPath(recovered.path) },
          path: recovered.path,
          dirty: repairs.length > 0,
        };
      } catch {
        // Moved or deleted since; fall back to the recovery copy.
      }
    }
    return {
      project: recovered.project,
      path: recovered.path,
      dirty: recovered.dirty || recovered.repairs.length > 0,
    };
  }
  return migrateLegacyState() ?? { project: newProject(), path: null, dirty: false };
}

/** Tells the user which saved values were invalid and reset. */
function repairsMessage(name: string, repairs: string[]) {
  const shown = repairs.slice(0, 8).map((path) => `• ${path}`).join("\n");
  const more = repairs.length > 8 ? `\n• …and ${repairs.length - 8} more` : "";
  return `Some values in "${name}" were not valid and were reset to defaults:\n\n${shown}${more}\n\nCheck them, then save to keep the corrected project.`;
}

export default function App() {
  const [initial, setInitial] = useState<Session | null>(null);

  useEffect(() => {
    let active = true;
    void restoreSession().then((session) => {
      if (active) setInitial(session);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!initial) {
    return <main className="app-loading">Opening AV-SW…</main>;
  }
  return (
    <ErrorBoundary
      onStartOver={() => {
        clearLegacyState();
        void clearRecovery().then(() => window.location.reload());
      }}
    >
      <Workspace initial={initial} />
    </ErrorBoundary>
  );
}

function Workspace({ initial }: { initial: Session }) {
  const desktop = isTauri();
  const theme = useTheme();

  const [session, setSession] = useState<Session>(initial);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const { project, path, dirty } = session;

  const [recents, setRecents] = useState<RecentProject[]>(loadRecents);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<DrawingAnalysis | null>(null);
  const [activeSystem, setActiveSystem] = useState<SystemName>("Lighting");
  const [inspectorView, setInspectorView] = useState<InspectorView>("system");
  const [activeTool, setActiveTool] = useState<ProjectTool | null>(null);
  const activeToolRef = useRef(activeTool);
  activeToolRef.current = activeTool;

  /** Shows the plan and asks the viewer for an editor tool. */
  const requestPlanTool = useCallback((tool: "design" | "measure") => {
    setActiveTool(null);
    window.dispatchEvent(new CustomEvent("avsw:plan-tool", { detail: tool }));
  }, []);

  useEffect(() => {
    void initializePersistence().catch((error: unknown) => {
      setStorageError(errorText(error));
    });
  }, []);

  // Keep the recovery copy current shortly after every change.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void saveRecovery(session).then((saved) => {
        if (saved) clearLegacyState();
      });
    }, RECOVERY_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [session]);

  useEffect(() => {
    void setWindowTitle(`${project.name}${dirty ? " •" : ""} — AV-SW`).catch(() => {});
  }, [project.name, dirty]);

  const updateProject = useCallback((patch: Partial<ProjectDocument>) => {
    setSession((current) => ({
      ...current,
      project: { ...current.project, ...patch },
      dirty: true,
    }));
  }, []);

  const rememberRecent = useCallback((recentPath: string, name: string) => {
    setRecents((list) => {
      const next = withRecent(list, { path: recentPath, name, openedAt: new Date().toISOString() });
      storeRecents(next);
      return next;
    });
  }, []);

  const forgetRecent = useCallback((recentPath: string) => {
    setRecents((list) => {
      const next = withoutRecent(list, recentPath);
      storeRecents(next);
      return next;
    });
  }, []);

  /** Saves to the current file, or asks where when there is none or `chooseLocation`. */
  const save = useCallback(
    async (chooseLocation = false): Promise<boolean> => {
      const current = sessionRef.current;
      try {
        const updatedAt = new Date().toISOString();
        const bytes = serializeProject(
          { ...current.project, updatedAt },
          { appVersion: APP_VERSION },
        );
        const result = await saveProjectBytes(bytes, {
          suggestedName: current.project.name,
          currentPath: current.path,
          chooseLocation,
        });
        if (!result) return false;

        const name = projectNameFromPath(result.name);
        const savedPath = result.path ?? current.path;
        setSession((latest) => ({
          project: { ...latest.project, name, updatedAt },
          path: savedPath,
          // Edits made while the file was being written are still unsaved.
          dirty: latest.project !== current.project,
        }));
        if (result.path) rememberRecent(result.path, name);
        void saveRecovery({
          project: { ...current.project, name, updatedAt },
          path: savedPath,
          dirty: false,
        });
        return true;
      } catch (error) {
        await showError(`The project could not be saved.\n\n${errorText(error)}`);
        return false;
      }
    },
    [rememberRecent],
  );

  /** Resolves true when it is fine to replace or close the current project. */
  const confirmLeave = useCallback(async () => {
    const current = sessionRef.current;
    if (!current.dirty) return true;
    const choice = await askUnsavedChanges(current.project.name);
    if (choice === "save") return save(false);
    return choice === "discard";
  }, [save]);

  const newProjectCommand = useCallback(async () => {
    if (!(await confirmLeave())) return;
    setActiveTool(null);
    setSession({ project: newProject(), path: null, dirty: false });
  }, [confirmLeave]);

  const openProjectCommand = useCallback(
    async (recentPath?: string) => {
      if (!(await confirmLeave())) return;

      let file;
      try {
        file = recentPath ? await readPath(recentPath) : await pickAndReadFile(PROJECT_FILTER);
      } catch (error) {
        if (recentPath) forgetRecent(recentPath);
        await showError(`The project could not be opened.\n\n${errorText(error)}`);
        return;
      }
      if (!file) return;

      try {
        const { project: opened, repairs } = parseProjectWithRepairs(file.bytes);
        const name = projectNameFromPath(file.path ?? file.name);
        setActiveTool(null);
        // A repaired project differs from the file, so it counts as unsaved.
        setSession({ project: { ...opened, name }, path: file.path, dirty: repairs.length > 0 });
        if (file.path) rememberRecent(file.path, name);
        if (repairs.length > 0) await showWarning(repairsMessage(name, repairs));
      } catch (error) {
        await showError(`${file.name} could not be opened.\n\n${errorText(error)}`);
      }
    },
    [confirmLeave, forgetRecent, rememberRecent],
  );

  // Design undo history (plan edits only). Cleared when the project or drawing changes.
  const designHistory = useRef({ past: [] as PlanDesign[], future: [] as PlanDesign[], lastKey: "", lastAt: 0 });
  const resetDesignHistory = useCallback(() => {
    designHistory.current = { past: [], future: [], lastKey: "", lastAt: 0 };
  }, []);
  useEffect(resetDesignHistory, [project.id, resetDesignHistory]);

  const changeDesign = useCallback(
    (next: PlanDesign, change: DesignChange = {}) => {
      const history = designHistory.current;
      if (!change.live) {
        const now = Date.now();
        const sameEdit = Boolean(change.coalesce) && change.coalesce === history.lastKey && now - history.lastAt < 1500;
        if (!sameEdit) {
          history.past.push(sessionRef.current.project.design);
          if (history.past.length > 200) history.past.shift();
        }
        history.future = [];
        history.lastKey = change.coalesce ?? "";
        history.lastAt = now;
      }
      updateProject({ design: next });
    },
    [updateProject],
  );

  const stepDesign = useCallback(
    (direction: "undo" | "redo") => {
      const history = designHistory.current;
      const target = direction === "undo" ? history.past.pop() : history.future.pop();
      if (!target) return;
      (direction === "undo" ? history.future : history.past).push(sessionRef.current.project.design);
      history.lastKey = "";
      updateProject({ design: target });
    },
    [updateProject],
  );

  const openDrawingCommand = useCallback(async () => {
    try {
      const file = await pickAndReadFile(DRAWING_FILTER);
      if (!file) return;
      const drawing = newDrawing(file.name, file.bytes);
      const current = sessionRef.current.project;
      let design = current.design;
      const previous = activeDrawing(current);
      if (previous) {
        const placed = design.items.filter((item) => item.drawingId === previous.id).length;
        let keep = false;
        if (placed > 0 && previous.kind === drawing.kind) {
          keep = await askYesNo(
            `Keep the ${placed} devices and runs from the previous drawing on ${file.name}? Keep them when this is a new revision of the same plan.`,
            "Keep them",
            "Remove them",
          );
        } else if (placed > 0) {
          // PDF points and DXF units don't line up, so positions can't be carried over.
          const proceed = await askYesNo(
            `The ${placed} devices and runs on ${previous.name} can't be moved onto a ${drawing.kind.toUpperCase()} drawing automatically, because the two drawing types use different coordinates. Remove them and open ${file.name}?`,
            "Remove and continue",
            "Cancel",
          );
          if (!proceed) return;
        }
        design = keep
          ? moveDesignToDrawing(design, previous.id, drawing.id)
          : removeDrawingFromDesign(design, previous.id);
      }
      setActiveTool(null);
      resetDesignHistory();
      // One drawing per project for now: a new drawing replaces the previous one.
      updateProject({ drawings: [drawing], activeDrawingId: drawing.id, draft: [], design });
    } catch (error) {
      await showError(`The drawing could not be opened.\n\n${errorText(error)}`);
    }
  }, [resetDesignHistory, updateProject]);

  // Keyboard shortcuts (also shown in the File menu).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        void save(event.shiftKey);
      } else if (key === "o" && !event.shiftKey) {
        event.preventDefault();
        void openProjectCommand();
      } else if (key === "n" && !event.shiftKey) {
        event.preventDefault();
        void newProjectCommand();
      } else if ((key === "z" || key === "y") && !activeToolRef.current && !isTypingTarget(event.target)) {
        // Plan undo/redo; text fields keep their own undo.
        event.preventDefault();
        stepDesign(key === "y" || event.shiftKey ? "redo" : "undo");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [newProjectCommand, openProjectCommand, save, stepDesign]);

  // Ask before closing with unsaved changes.
  useEffect(() => {
    if (!desktop) {
      const onBeforeUnload = (event: BeforeUnloadEvent) => {
        if (!sessionRef.current.dirty) return;
        event.preventDefault();
        event.returnValue = "";
      };
      window.addEventListener("beforeunload", onBeforeUnload);
      return () => window.removeEventListener("beforeunload", onBeforeUnload);
    }

    let stopListening: (() => void) | undefined;
    let disposed = false;
    void import("@tauri-apps/api/window").then(async ({ getCurrentWindow }) => {
      const appWindow = getCurrentWindow();
      const unlisten = await appWindow.onCloseRequested(async (event) => {
        if (!sessionRef.current.dirty) return;
        event.preventDefault();
        const current = sessionRef.current;
        const choice = await askUnsavedChanges(current.project.name);
        if (choice === "cancel") return;
        if (choice === "save" && !(await save(false))) return;
        // "Don't Save" means the changes should not come back next launch.
        if (choice === "discard") await clearRecovery();
        await appWindow.destroy();
      });
      if (disposed) unlisten();
      else stopListening = unlisten;
    });
    return () => {
      disposed = true;
      stopListening?.();
    };
  }, [desktop, save]);

  const setRetrofitSurvey = useCallback(
    (survey: RetrofitSurvey) => updateProject({ survey }),
    [updateProject],
  );
  const setProjectTools = useCallback(
    (tools: ProjectToolsState) => updateProject({ tools }),
    [updateProject],
  );
  const setDraft = useCallback(
    (draft: DraftRecommendation[]) => updateProject({ draft }),
    [updateProject],
  );

  const projectMode = project.mode;
  const retrofitSurvey = project.survey;
  const projectTools = project.tools;
  const draft = project.draft;
  const drawing = activeDrawing(project);

  const baseBom = useMemo(
    () => generatePreliminaryBom(analysis, draft, projectMode),
    [analysis, draft, projectMode],
  );

  // Scale per sheet; DXF units are only known for the drawing currently parsed.
  const dxfUnits = analysis?.units ?? null;
  const scaleOf = useCallback(
    (item: PlanItem) =>
      effectiveScale(
        project.design,
        item.drawingId,
        item.page,
        item.drawingId === project.activeDrawingId ? dxfUnits : null,
      ),
    [project.design, project.activeDrawingId, dxfUnits],
  );
  const planBom = useMemo(() => designBom(project.design, scaleOf), [project.design, scaleOf]);

  const bom = useMemo(() => {
    const scopedBase =
      projectMode === "retrofit"
        ? applyRetrofitSurvey(baseBom, retrofitSurvey)
        : baseBom;

    return [
      ...mergeDesignBom(scopedBase, planBom),
      ...generateToolBom(projectTools, projectMode),
    ];
  }, [baseBom, planBom, projectMode, retrofitSurvey, projectTools]);

  const issues = useMemo(
    () =>
      validateProject({
        bom,
        mode: projectMode,
        survey: retrofitSurvey,
        tools: projectTools,
      }),
    [bom, projectMode, retrofitSurvey, projectTools],
  );

  function chooseSystem(system: SystemName) {
    setActiveTool(null);
    setActiveSystem(system);
    setInspectorView("system");
  }

  function setMode(mode: ProjectMode) {
    setActiveTool(null);
    if (mode !== projectMode) updateProject({ mode });
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
          <FileMenu
            desktop={desktop}
            recents={recents}
            onNew={() => void newProjectCommand()}
            onOpen={() => void openProjectCommand()}
            onOpenRecent={(recentPath) => void openProjectCommand(recentPath)}
            onSave={() => void save(false)}
            onSaveAs={() => void save(true)}
            onOpenDrawing={() => void openDrawingCommand()}
          />
          <span
            className="project-title"
            title={path ?? (desktop ? "Not saved yet" : "Browser mode: Save downloads a copy")}
          >
            {project.name}
            {dirty && (
              <span className="dirty-dot" aria-label="Unsaved changes" title="Unsaved changes">
                •
              </span>
            )}
          </span>
          <span className={`runtime-badge ${desktop ? "desktop" : "browser"}`}>
            {desktop ? "Desktop" : "Browser Dev"}
          </span>
        </div>

        <div className="top-actions">
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
            <button onClick={() => void openDrawingCommand()}>
              {drawing ? "Replace Drawing" : "Open Drawing"}
            </button>
            <button disabled={!drawing} onClick={() => requestPlanTool("design")}>
              Place Device
            </button>
            <button disabled={!drawing} onClick={() => requestPlanTool("measure")}>
              Measure
            </button>
            <button disabled>Draw Room</button>
          </div>

          <div className="sidebar-section">
            <h3>Project File</h3>
            <p className="sidebar-note project-path" title={path ?? undefined}>
              {path ??
                (desktop
                  ? "Not saved yet. Press Ctrl+S to choose where to save it."
                  : "Browser mode: Save downloads an .avsw file.")}
            </p>
            <p className="sidebar-note">
              {storageError
                ? `Local database error: ${storageError}`
                : "Unsaved changes are kept in a recovery copy until you save."}
            </p>
          </div>
        </aside>

        {activeTool && (
          <ProjectToolsWorkspace
            activeTool={activeTool}
            onToolChange={setActiveTool}
            onClose={() => setActiveTool(null)}
            state={projectTools}
            onStateChange={setProjectTools}
            bom={bom}
            mode={projectMode}
            survey={retrofitSurvey}
            design={project.design}
            scaleOf={scaleOf}
          />
        )}

        {/* Stay mounted while a tool is open (hidden by .tools-open) so the
            loaded drawing is not re-parsed when the tool closes. */}
        <DrawingViewer
          drawing={drawing}
          design={project.design}
          active={!activeTool}
          onDesignChange={changeDesign}
          onOpenDrawing={() => void openDrawingCommand()}
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
          issues={issues}
          onOpenValidation={() => setActiveTool("validate")}
        />
      </section>
    </main>
  );
}
