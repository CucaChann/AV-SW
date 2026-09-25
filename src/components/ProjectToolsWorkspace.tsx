import type { BomItem, ProjectMode, RetrofitSurvey } from "../lib/design";
import type { ScaleLookup } from "../lib/designBom";
import type { PlanDesign } from "../lib/planDesign";
import type { ProjectTool, ProjectToolsState } from "../lib/projectTools";
import QtlStudio from "./tools/QtlStudio";
import NetworkBuilder from "./tools/NetworkBuilder";
import AudioZoneBuilder from "./tools/AudioZoneBuilder";
import VideoChainBuilder from "./tools/VideoChainBuilder";
import CablingBuilder from "./tools/CablingBuilder";
import DeviceSchedule from "./tools/DeviceSchedule";
import BudgetBuilder from "./tools/BudgetBuilder";
import { ManufacturerLibrary, ValidationPanel } from "./tools/LibraryAndValidation";

type Props = {
  activeTool: ProjectTool;
  onToolChange: (tool: ProjectTool) => void;
  onClose: () => void;
  state: ProjectToolsState;
  onStateChange: (state: ProjectToolsState) => void;
  bom: BomItem[];
  mode: ProjectMode;
  survey: RetrofitSurvey;
  design: PlanDesign;
  scaleOf: ScaleLookup;
};

const TOOLS: Array<{ id: ProjectTool; label: string; short: string }> = [
  { id: "qtl", label: "QTL Studio", short: "Linear lighting" },
  { id: "network", label: "Network Builder", short: "UniFi / site topology" },
  { id: "audio", label: "Audio Zones", short: "Speakers / amps / control" },
  { id: "video", label: "Video Chain", short: "TV / Apple TV / Savant" },
  { id: "cabling", label: "Cabling", short: "Runs / footage / types" },
  { id: "budget", label: "Budget", short: "Core / Refined / Signature" },
  { id: "schedule", label: "Device Schedule", short: "Everything on the plan" },
  { id: "library", label: "Library", short: "Manufacturers / assemblies" },
  { id: "validate", label: "Validate", short: "Cross-system checks" },
];

export default function ProjectToolsWorkspace({
  activeTool,
  onToolChange,
  onClose,
  state,
  onStateChange,
  bom,
  mode,
  survey,
  design,
  scaleOf,
}: Props) {
  return (
    <section className="project-tools-workspace">
      <aside className="tool-nav">
        <div className="tool-nav-header">
          <div>
            <span className="eyebrow">AV-SW</span>
            <h2>Project Tools</h2>
          </div>
          <button onClick={onClose}>Drawing</button>
        </div>

        <nav>
          {TOOLS.map((tool) => (
            <button
              key={tool.id}
              className={activeTool === tool.id ? "active" : ""}
              onClick={() => onToolChange(tool.id)}
            >
              <span>{tool.label}</span>
              <small>{tool.short}</small>
            </button>
          ))}
        </nav>
      </aside>

      <main className="tool-content">
        {activeTool === "qtl" && <QtlStudio state={state} onChange={onStateChange} />}
        {activeTool === "network" && <NetworkBuilder state={state} onChange={onStateChange} />}
        {activeTool === "audio" && <AudioZoneBuilder state={state} onChange={onStateChange} />}
        {activeTool === "video" && <VideoChainBuilder state={state} onChange={onStateChange} />}
        {activeTool === "cabling" && <CablingBuilder state={state} onChange={onStateChange} />}
        {activeTool === "budget" && <BudgetBuilder state={state} onChange={onStateChange} />}
        {activeTool === "schedule" && <DeviceSchedule design={design} scaleOf={scaleOf} onShowPlan={onClose} />}
        {activeTool === "library" && <ManufacturerLibrary />}
        {activeTool === "validate" && (
          <ValidationPanel tools={state} bom={bom} mode={mode} survey={survey} />
        )}
      </main>
    </section>
  );
}
