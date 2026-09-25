import { useMemo, useState } from "react";
import type { BomItem, ProjectMode, RetrofitSurvey } from "../../lib/design";
import type { PlanDesign } from "../../lib/planDesign";
import {
  MANUFACTURERS,
  validateProject,
  type ProjectToolsState,
} from "../../lib/projectTools";

export function ManufacturerLibrary() {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return MANUFACTURERS;
    return MANUFACTURERS.filter((item) =>
      [item.name, item.focus, ...item.categories]
        .join(" ")
        .toLowerCase()
        .includes(value),
    );
  }, [query]);

  return (
    <div className="tool-page">
      <div className="tool-page-heading">
        <div>
          <span className="eyebrow">Source-Backed Knowledge</span>
          <h1>Manufacturer + Compatibility Library</h1>
          <p>
            Seed catalog for the product/document intelligence layer. Exact models and
            document revisions will be tied to official sources as ingestion grows.
          </p>
        </div>
      </div>

      <label className="field library-search">
        <span>Search manufacturer, category or use</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="QTL, K-array, Revel, Savant, network, cinema..."
        />
      </label>

      <section className="builder-card">
        <div className="builder-card-header">
          <h3>Known-good assembly patterns</h3>
          <span className="badge">Templates</span>
        </div>
        <div className="assembly-grid">
          <article>
            <strong>Premium TV + Control</strong>
            <p>Sony/Samsung display → Apple TV/local source → Savant IP/IR/CEC path → Leon/Sonos/AVR audio → compatible mount/backbox → network/power.</p>
          </article>
          <article>
            <strong>Distributed Audio Zone</strong>
            <p>Room intent → speaker family → wiring → DSP multi-channel amp / AVR → control experience → optional subwoofer → validation.</p>
          </article>
          <article>
            <strong>UniFi Upgrade</strong>
            <p>WAN target → gateway → switching/uplinks → PoE budget → indoor/outdoor APs → CAT6A/fiber pathways → rack/UPS → RF validation.</p>
          </article>
          <article>
            <strong>Linear Lighting</strong>
            <p>Application → dimensions → QTL family/profile → W/ft → driver → feed → dimming → access → RFQ and quote-revision check.</p>
          </article>
        </div>
        <p className="tool-footnote">
          These are workflow templates, not claims that every product combination is compatible.
          Exact model compatibility is validated only after model-level source data is available.
        </p>
      </section>

      <div className="manufacturer-grid">
        {filtered.map((item) => (
          <article className="manufacturer-card" key={item.name}>
            <div className="builder-card-header">
              <h3>{item.name}</h3>
              <span className="badge">Seed</span>
            </div>
            <div className="chip-list">
              {item.categories.map((category) => <span className="chip" key={category}>{category}</span>)}
            </div>
            <p>{item.focus}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

export function ValidationPanel({
  tools,
  bom,
  mode,
  survey,
  design,
}: {
  tools: ProjectToolsState;
  bom: BomItem[];
  mode: ProjectMode;
  survey: RetrofitSurvey;
  design: PlanDesign;
}) {
  const issues = useMemo(
    () => validateProject({ tools, bom, mode, survey, design }),
    [tools, bom, mode, survey, design],
  );

  const counts = {
    Blocker: issues.filter((issue) => issue.severity === "Blocker").length,
    Warning: issues.filter((issue) => issue.severity === "Warning").length,
    Info: issues.filter((issue) => issue.severity === "Info").length,
  };

  return (
    <div className="tool-page">
      <div className="tool-page-heading">
        <div>
          <span className="eyebrow">Cross-System Review</span>
          <h1>Validate Project</h1>
          <p>
            Run the currently implemented compatibility, completeness, budget and retrofit checks across the project.
          </p>
        </div>
      </div>

      <div className="tool-summary-grid">
        <article><span>Blockers</span><strong className="negative">{counts.Blocker}</strong></article>
        <article><span>Warnings</span><strong>{counts.Warning}</strong></article>
        <article><span>Information</span><strong>{counts.Info}</strong></article>
        <article><span>Total checks surfaced</span><strong>{issues.length}</strong></article>
      </div>

      <div className="validation-list">
        {issues.map((issue) => (
          <article className={"validation-card " + issue.severity.toLowerCase()} key={issue.id}>
            <div>
              <span className="eyebrow">{issue.system}</span>
              <p>{issue.message}</p>
            </div>
            <span className="validation-severity">{issue.severity}</span>
          </article>
        ))}
      </div>

      <section className="builder-card">
        <h3>Next validation layers</h3>
        <p className="muted">
          Geometry-based speaker/AP/keypad placement, RF heatmaps, exact product-model compatibility,
          PoE watts, rack thermal calculations, amplifier loads, QTL current-document rules and
          revision-impact checks can plug into this same screen as those engines mature.
        </p>
      </section>
    </div>
  );
}
