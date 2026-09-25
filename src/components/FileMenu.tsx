import { useEffect, useRef, useState } from "react";
import type { RecentProject } from "../lib/recents";

type Props = {
  desktop: boolean;
  recents: RecentProject[];
  onNew: () => void;
  onOpen: () => void;
  onOpenRecent: (path: string) => void;
  onSave: () => void;
  onSaveAs: () => void;
  onOpenDrawing: () => void;
};

export default function FileMenu({
  desktop,
  recents,
  onNew,
  onOpen,
  onOpenRecent,
  onSave,
  onSaveAs,
  onOpenDrawing,
}: Props) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const run = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  return (
    <div className="file-menu" ref={menuRef}>
      <button
        className={open ? "active" : ""}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        File
      </button>

      {open && (
        <div className="file-menu-panel" role="menu">
          <button role="menuitem" onClick={run(onNew)}>
            <span>New Project</span>
            <kbd>Ctrl+N</kbd>
          </button>
          <button role="menuitem" onClick={run(onOpen)}>
            <span>Open Project…</span>
            <kbd>Ctrl+O</kbd>
          </button>
          <button role="menuitem" onClick={run(onSave)}>
            <span>{desktop ? "Save" : "Save (download)"}</span>
            <kbd>Ctrl+S</kbd>
          </button>
          <button role="menuitem" onClick={run(onSaveAs)}>
            <span>Save As…</span>
            <kbd>Ctrl+Shift+S</kbd>
          </button>

          <hr />

          <button role="menuitem" onClick={run(onOpenDrawing)}>
            <span>Open Drawing…</span>
          </button>

          {desktop && recents.length > 0 && (
            <>
              <hr />
              <div className="file-menu-label">Recent projects</div>
              {recents.map((recent) => (
                <button
                  key={recent.path}
                  role="menuitem"
                  title={recent.path}
                  onClick={run(() => onOpenRecent(recent.path))}
                >
                  <span>{recent.name}</span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
