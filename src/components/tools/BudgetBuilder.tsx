import { budgetTotals, exportCsv, type DesignTier, type ProjectToolsState } from "../../lib/projectTools";
import { SYSTEMS as SYSTEM_DEFINITIONS, type SystemName } from "../../lib/design";

type Props = {
  state: ProjectToolsState;
  onChange: (state: ProjectToolsState) => void;
};

const SYSTEMS: SystemName[] = SYSTEM_DEFINITIONS.map((system) => system.name);

export default function BudgetBuilder({ state, onChange }: Props) {
  const plan = state.budget;
  const totals = budgetTotals(plan);

  const updateAllocation = (system: SystemName, value: number) =>
    onChange({
      ...state,
      budget: {
        ...plan,
        allocations: { ...plan.allocations, [system]: value },
      },
    });

  const exportBudget = () =>
    exportCsv("av-sw-budget-plan.csv", [
      ["Tier", plan.tier],
      ["Target Budget", String(plan.total)],
      ["Allocated", String(totals.allocated)],
      ["Remaining", String(totals.remaining)],
      [],
      ["System","Allocation"],
      ...SYSTEMS.map((system) => [system, String(plan.allocations[system])]),
      [],
      ["Notes", plan.notes],
    ]);

  return (
    <div className="tool-page">
      <div className="tool-page-heading">
        <div>
          <span className="eyebrow">Client Planning</span>
          <h1>Budget + Design Tier</h1>
          <p>Allocate a client target across systems without automatically forcing the most expensive solution.</p>
        </div>
        <button onClick={exportBudget}>Export Budget CSV</button>
      </div>

      <div className="builder-card">
        <div className="builder-form-grid three">
          <label className="field">
            <span>Target project budget</span>
            <input type="number" min="0" step="500" value={plan.total} onChange={(e) => onChange({ ...state, budget: { ...plan, total: Number(e.target.value) || 0 } })} />
          </label>
          <label className="field">
            <span>Design tier</span>
            <select value={plan.tier} onChange={(e) => onChange({ ...state, budget: { ...plan, tier: e.target.value as DesignTier } })}>
              <option>Core</option>
              <option>Refined</option>
              <option>Signature</option>
            </select>
          </label>
        </div>
      </div>

      <div className="tool-summary-grid">
        <article><span>Target</span><strong>{"$" + plan.total.toLocaleString()}</strong></article>
        <article><span>Allocated</span><strong>{"$" + totals.allocated.toLocaleString()}</strong></article>
        <article><span>Remaining</span><strong className={totals.remaining < 0 ? "negative" : ""}>{"$" + totals.remaining.toLocaleString()}</strong></article>
        <article><span>Allocation</span><strong>{totals.percent.toFixed(0)}%</strong></article>
      </div>

      <div className="budget-grid">
        {SYSTEMS.map((system) => (
          <label className="budget-row" key={system}>
            <span>{system}</span>
            <input type="number" min="0" step="250" value={plan.allocations[system]} onChange={(e) => updateAllocation(system, Number(e.target.value) || 0)} />
          </label>
        ))}
      </div>

      <section className="builder-card">
        <h3>{plan.tier} intent</h3>
        <p className="muted">
          {plan.tier === "Core" && "Prioritize reliable infrastructure, compatibility and client usability while controlling custom fabrication and premium finishes."}
          {plan.tier === "Refined" && "Balance premium architectural integration with practical spend, using custom solutions where they materially improve the room."}
          {plan.tier === "Signature" && "Allow high-end architectural finishes, invisible/custom audio, advanced lighting/shading and premium control where justified by the project."}
        </p>
      </section>

      <label className="field">
        <span>Budget notes / client priorities</span>
        <textarea rows={4} value={plan.notes} onChange={(e) => onChange({ ...state, budget: { ...plan, notes: e.target.value } })} />
      </label>
    </div>
  );
}
