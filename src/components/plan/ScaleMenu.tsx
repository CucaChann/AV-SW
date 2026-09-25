import { useEffect, useRef, useState } from "react";
import { ARCHITECTURAL_SCALES, type DrawingScale } from "../../lib/planDesign";

type Props = {
  kind: "pdf" | "dxf";
  /** The scale in effect (stored calibration, or the DXF's own units). */
  scale: DrawingScale | undefined;
  /** True when a calibration or plot scale is stored for this sheet. */
  stored: boolean;
  onCalibrate: () => void;
  onPreset: (unitsPerFoot: number, label: string) => void;
  onReset: () => void;
};

export default function ScaleMenu({ kind, scale, stored, onCalibrate, onPreset, onReset }: Props) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const run = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  return (
    <div className="scale-menu" ref={menuRef}>
      <button
        className={scale ? "" : "attention"}
        onClick={() => setOpen((value) => !value)}
        title="Drawing scale used for run lengths"
      >
        {scale ? `Scale: ${scale.label}` : "Set scale"}
      </button>
      {open && (
        <div className="file-menu-panel scale-menu-panel" role="menu">
          <button role="menuitem" onClick={run(onCalibrate)}>
            <span>Calibrate from two points…</span>
          </button>
          {kind === "pdf" && (
            <>
              <hr />
              <div className="file-menu-label">Plotted at (only if printed to scale)</div>
              {ARCHITECTURAL_SCALES.map((preset) => (
                <button key={preset.label} role="menuitem" onClick={run(() => onPreset(preset.unitsPerFoot, preset.label))}>
                  <span>{preset.label}</span>
                </button>
              ))}
            </>
          )}
          {stored && (
            <>
              <hr />
              <button role="menuitem" onClick={run(onReset)}>
                <span>{kind === "dxf" ? "Use the drawing's own units" : "Clear scale"}</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
