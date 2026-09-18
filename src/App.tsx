import { isTauri } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import FloorplanViewer from "./components/FloorplanViewer";
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

  useEffect(() => {
    void initializePersistence()
      .then(setPersistence)
      .catch((error: unknown) => {
        setStorageError(
          error instanceof Error ? error.message : "Storage initialization failed",
        );
      });
  }, []);

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
              Open Floorplan
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
