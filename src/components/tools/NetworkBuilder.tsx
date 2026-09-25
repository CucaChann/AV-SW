import { networkDerived, type NetworkPlan, type ProjectToolsState } from "../../lib/projectTools";

type Props = {
  state: ProjectToolsState;
  onChange: (state: ProjectToolsState) => void;
};

function n(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function NetworkBuilder({ state, onChange }: Props) {
  const plan = state.network;
  const update = (patch: Partial<NetworkPlan>) =>
    onChange({ ...state, network: { ...plan, ...patch } });

  const derived = networkDerived(plan);

  return (
    <div className="tool-page">
      <div className="tool-page-heading">
        <div>
          <span className="eyebrow">Requirement-Driven</span>
          <h1>Network Builder</h1>
          <p>
            Size the site before choosing exact UniFi hardware. Supports apartments,
            multi-floor homes, outdoor coverage and multi-building properties.
          </p>
        </div>
      </div>

      <div className="builder-card">
        <div className="builder-form-grid three">
          <label className="field"><span>Buildings</span><input type="number" min="1" value={plan.buildings} onChange={(e) => update({ buildings: Math.max(1, n(e.target.value)) })} /></label>
          <label className="field"><span>Floors</span><input type="number" min="1" value={plan.floors} onChange={(e) => update({ floors: Math.max(1, n(e.target.value)) })} /></label>
          <label className="field"><span>WAN target Gbps</span><input type="number" min="0" step="0.5" value={plan.wanGbps} onChange={(e) => update({ wanGbps: n(e.target.value) })} /></label>
          <label className="field"><span>Wired endpoints</span><input type="number" min="0" value={plan.wiredEndpoints} onChange={(e) => update({ wiredEndpoints: n(e.target.value) })} /></label>
          <label className="field"><span>Other PoE endpoints</span><input type="number" min="0" value={plan.poeEndpoints} onChange={(e) => update({ poeEndpoints: n(e.target.value) })} /></label>
          <label className="field"><span>Cameras</span><input type="number" min="0" value={plan.cameras} onChange={(e) => update({ cameras: n(e.target.value) })} /></label>
          <label className="field"><span>Indoor APs</span><input type="number" min="0" value={plan.indoorAps} onChange={(e) => update({ indoorAps: n(e.target.value) })} /></label>
          <label className="field"><span>Outdoor APs</span><input type="number" min="0" value={plan.outdoorAps} onChange={(e) => update({ outdoorAps: n(e.target.value) })} /></label>
          <label className="field"><span>Backbone target Gbps</span><input type="number" min="0" step="0.5" value={plan.targetBackboneGbps} onChange={(e) => update({ targetBackboneGbps: n(e.target.value) })} /></label>
          <label className="field"><span>Rack / distribution locations</span><input type="number" min="0" value={plan.rackLocations} onChange={(e) => update({ rackLocations: n(e.target.value) })} /></label>
          <label className="field">
            <span>Target platform</span>
            <select value={plan.targetPlatform} onChange={(e) => update({ targetPlatform: e.target.value as NetworkPlan["targetPlatform"] })}>
              <option>UniFi</option>
              <option>Mixed / Existing</option>
            </select>
          </label>
        </div>
      </div>

      <div className="tool-summary-grid">
        <article><span>Endpoint ports</span><strong>{derived.endpointPorts}</strong></article>
        <article><span>Working port target</span><strong>{derived.portTarget}+</strong></article>
        <article><span>PoE port target</span><strong>{derived.poeTarget}+</strong></article>
        <article><span>Topology</span><strong>{plan.buildings > 1 ? "Multi-building" : plan.floors > 1 ? "Multi-floor" : "Single site"}</strong></article>
      </div>

      <section className="builder-card">
        <div className="builder-card-header">
          <h3>Architecture guidance</h3>
          <span className="badge">{plan.targetPlatform}</span>
        </div>
        <div className="check-list">
          {derived.recommendations.map((item) => <p key={item}>✓ {item}</p>)}
        </div>
      </section>

      <section className="builder-card">
        <h3>Predictive Wi-Fi coverage</h3>
        <p className="muted">
          AP counts and site topology are now stored. The next geometry engine can place AP objects on the drawing
          and render 2.4 / 5 / 6 GHz heatmaps using walls/material assumptions.
        </p>
      </section>

      <label className="field">
        <span>Network notes</span>
        <textarea rows={4} value={plan.notes} onChange={(e) => update({ notes: e.target.value })} />
      </label>
    </div>
  );
}
