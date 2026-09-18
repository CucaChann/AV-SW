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

export default function Home() {
  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <strong>AV-SW</strong>
          <span className="muted">Design Workspace</span>
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
            <button>Upload Floorplan</button>
            <button>Measure</button>
            <button>Draw Room</button>
            <button>Place Device</button>
          </div>
        </aside>

        <section className="canvas-wrap">
          <div className="canvas-toolbar">
            <button>−</button>
            <span>100%</span>
            <button>+</button>
            <button>Fit</button>
          </div>

          <div className="canvas">
            <div className="canvas-placeholder">
              <div className="plan-mark">+</div>
              <h1>Floorplan Canvas</h1>
              <p>PDF rendering and interactive placement come next.</p>
              <button className="primary">Upload Floorplan</button>
            </div>
          </div>
        </section>

        <aside className="inspector">
          <h2>Properties</h2>
          <div className="empty-state">
            <p>Select a room, device, QTL run, shade, or drawing object.</p>
          </div>

          <div className="issues">
            <div className="panel-heading">
              <h3>Design Issues</h3>
              <span className="badge">0</span>
            </div>
            <p className="muted">No issues yet.</p>
          </div>
        </aside>
      </section>
    </main>
  );
}
