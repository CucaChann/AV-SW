import { formatFeet } from "../../lib/planDesign";
import { planLengthDifference, qtlRunTotalFt } from "../../lib/qtlBridge";
import type { QtlRun } from "../../lib/projectTools";

type Props = {
  /** Real length of the plan line, or null when the sheet has no scale. */
  lengthFt: number | null;
  run: QtlRun | undefined;
  onCreate: () => void;
  onOpen: () => void;
  onUsePlanLength: () => void;
};

/** Item-card section linking a drawn linear-light line to QTL Studio. */
export default function QtlLinkActions({ lengthFt, run, onCreate, onOpen, onUsePlanLength }: Props) {
  if (!run) {
    return (
      <div className="item-card-link">
        <p className="muted">
          {lengthFt === null
            ? "Set the sheet scale to measure this line before sending it to QTL Studio."
            : `Send this ${formatFeet(lengthFt)} line to QTL Studio to choose the fixture and power supply.`}
        </p>
        <button className="primary" disabled={lengthFt === null} onClick={onCreate}>
          Create QTL run
        </button>
      </div>
    );
  }

  const difference = lengthFt === null ? null : planLengthDifference(run, lengthFt);
  return (
    <div className="item-card-link">
      <p>
        <strong>QTL run:</strong> {run.fixtureQty} × {formatFeet(run.lengthFt)} ·{" "}
        {run.selectedFamily.startsWith("TBD") ? "fixture not selected" : run.selectedFamily}
      </p>
      {difference !== null && lengthFt !== null && (
        <p className="attention-text">
          The plan line is {formatFeet(lengthFt)}; the QTL run totals {formatFeet(qtlRunTotalFt(run))}.
        </p>
      )}
      <div className="item-card-actions">
        {difference !== null && <button onClick={onUsePlanLength}>Use plan length</button>}
        <button className="primary" onClick={onOpen}>
          Open in QTL Studio
        </button>
      </div>
    </div>
  );
}
