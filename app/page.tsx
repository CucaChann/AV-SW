import FloorplanViewer from "@/components/FloorplanViewer";

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
            <label className="button-like" htmlFor="floorplan-upload">
              Upload Floorplan
            </label>
            <button>Measure</button>
            <button>Draw Room</button>
            <button>Place Device</button>
          </div>
        </aside>

        <FloorplanViewer />

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
