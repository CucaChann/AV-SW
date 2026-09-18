import type {
  ExistingAudioPlatform,
  ExistingControlPlatform,
  ExistingNetworkPlatform,
  RetrofitSurvey,
} from "../lib/design";

type Props = {
  value: RetrofitSurvey;
  onChange: (value: RetrofitSurvey) => void;
};

const CONTROL_OPTIONS: ExistingControlPlatform[] = [
  "Unknown",
  "None",
  "RadioRA 2",
  "RadioRA 3",
  "HomeWorks QS",
  "HomeWorks QSX",
  "Other",
];

const NETWORK_OPTIONS: ExistingNetworkPlatform[] = [
  "Unknown",
  "None",
  "UniFi",
  "Araknis",
  "Ruckus",
  "Eero",
  "Other",
];

const AUDIO_OPTIONS: ExistingAudioPlatform[] = [
  "Unknown",
  "None",
  "Sonance / James",
  "Leon",
  "Mixed",
  "Other",
];

function numberValue(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export default function RetrofitSurveyPanel({ value, onChange }: Props) {
  const update = <K extends keyof RetrofitSurvey>(
    key: K,
    nextValue: RetrofitSurvey[K],
  ) => {
    onChange({ ...value, [key]: nextValue });
  };

  return (
    <section className="inspector-card retrofit-survey">
      <div className="panel-heading">
        <div>
          <h3>Existing Conditions Survey</h3>
          <p className="muted mini-copy">
            Use what is actually installed to turn the generic retrofit BOM
            into a project-specific delta.
          </p>
        </div>
        <span className="badge">Survey</span>
      </div>

      <label className="field">
        <span>Lighting control platform</span>
        <select
          value={value.controlPlatform}
          onChange={(event) =>
            update(
              "controlPlatform",
              event.target.value as ExistingControlPlatform,
            )
          }
        >
          {CONTROL_OPTIONS.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Network platform</span>
        <select
          value={value.networkPlatform}
          onChange={(event) =>
            update(
              "networkPlatform",
              event.target.value as ExistingNetworkPlatform,
            )
          }
        >
          {NETWORK_OPTIONS.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Existing audio platform</span>
        <select
          value={value.audioPlatform}
          onChange={(event) =>
            update(
              "audioPlatform",
              event.target.value as ExistingAudioPlatform,
            )
          }
        >
          {AUDIO_OPTIONS.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      </label>

      <div className="survey-grid">
        <label className="field">
          <span>Speakers</span>
          <input
            type="number"
            min="0"
            value={value.speakerCount}
            onChange={(event) =>
              update("speakerCount", numberValue(event.target.value))
            }
          />
        </label>

        <label className="field">
          <span>CAT drops</span>
          <input
            type="number"
            min="0"
            value={value.catDrops}
            onChange={(event) =>
              update("catDrops", numberValue(event.target.value))
            }
          />
        </label>

        <label className="field">
          <span>Displays</span>
          <input
            type="number"
            min="0"
            value={value.displayCount}
            onChange={(event) =>
              update("displayCount", numberValue(event.target.value))
            }
          />
        </label>

        <label className="field">
          <span>Shades / openings</span>
          <input
            type="number"
            min="0"
            value={value.shadeCount}
            onChange={(event) =>
              update("shadeCount", numberValue(event.target.value))
            }
          />
        </label>
      </div>

      <label className="check-row">
        <input
          type="checkbox"
          checked={value.hasRack}
          onChange={(event) => update("hasRack", event.target.checked)}
        />
        <span>Existing AV/network rack</span>
      </label>

      <h4 className="panel-subheading">Preserve where practical</h4>

      <label className="check-row">
        <input
          type="checkbox"
          checked={value.preserveSpeakers}
          onChange={(event) =>
            update("preserveSpeakers", event.target.checked)
          }
        />
        <span>Existing architectural speakers</span>
      </label>

      <label className="check-row">
        <input
          type="checkbox"
          checked={value.preserveCabling}
          onChange={(event) =>
            update("preserveCabling", event.target.checked)
          }
        />
        <span>Existing structured cabling</span>
      </label>

      <label className="check-row">
        <input
          type="checkbox"
          checked={value.preserveRack}
          onChange={(event) => update("preserveRack", event.target.checked)}
        />
        <span>Existing rack / enclosure</span>
      </label>

      <h4 className="panel-subheading">Target platform</h4>

      <label className="check-row">
        <input
          type="checkbox"
          checked={value.targetHomeWorks}
          onChange={(event) =>
            update("targetHomeWorks", event.target.checked)
          }
        />
        <span>Lutron HomeWorks target</span>
      </label>

      <label className="check-row">
        <input
          type="checkbox"
          checked={value.targetUnifi}
          onChange={(event) =>
            update("targetUnifi", event.target.checked)
          }
        />
        <span>UniFi-first network target</span>
      </label>

      <label className="field notes-field">
        <span>Survey notes</span>
        <textarea
          rows={4}
          placeholder="Example: keep existing Sonance speakers; replace Araknis router; client wants HomeWorks and new Palladiom keypads..."
          value={value.notes}
          onChange={(event) => update("notes", event.target.value)}
        />
      </label>
    </section>
  );
}
