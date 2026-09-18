import {
  audioZoneWarnings,
  newAudioZone,
  type AudioZone,
  type ProjectToolsState,
} from "../../lib/projectTools";

type Props = {
  state: ProjectToolsState;
  onChange: (state: ProjectToolsState) => void;
};

export default function AudioZoneBuilder({ state, onChange }: Props) {
  const addZone = () =>
    onChange({ ...state, audioZones: [...state.audioZones, newAudioZone()] });

  const updateZone = (id: string, patch: Partial<AudioZone>) =>
    onChange({
      ...state,
      audioZones: state.audioZones.map((zone) =>
        zone.id === id ? { ...zone, ...patch } : zone,
      ),
    });

  const removeZone = (id: string) =>
    onChange({
      ...state,
      audioZones: state.audioZones.filter((zone) => zone.id !== id),
    });

  return (
    <div className="tool-page">
      <div className="tool-page-heading">
        <div>
          <span className="eyebrow">System Builder</span>
          <h1>Audio Zone Builder</h1>
          <p>
            Define room intent, speaker type, amplification, control and subwoofer needs without forcing one ecosystem everywhere.
          </p>
        </div>
        <button className="primary" onClick={addZone}>+ Add Audio Zone</button>
      </div>

      {!state.audioZones.length && (
        <div className="tool-empty">
          Add a zone for distributed audio, TV/casual use, critical music, theater, or outdoor audio.
        </div>
      )}

      <div className="builder-list">
        {state.audioZones.map((zone, index) => {
          const warnings = audioZoneWarnings(zone);
          return (
            <article className="builder-card" key={zone.id}>
              <div className="builder-card-header">
                <div>
                  <span className="eyebrow">Zone {index + 1}</span>
                  <h3>{zone.room || "Unassigned room"}</h3>
                </div>
                <button onClick={() => removeZone(zone.id)}>Remove</button>
              </div>

              <div className="builder-form-grid three">
                <label className="field"><span>Room</span><input value={zone.room} onChange={(e) => updateZone(zone.id, { room: e.target.value })} /></label>
                <label className="field"><span>Purpose</span><select value={zone.purpose} onChange={(e) => updateZone(zone.id, { purpose: e.target.value as AudioZone["purpose"] })}>{["Distributed Audio","TV / Casual","Critical Music","Home Theater","Outdoor"].map((v) => <option key={v}>{v}</option>)}</select></label>
                <label className="field"><span>Speaker type</span><select value={zone.speakerType} onChange={(e) => updateZone(zone.id, { speakerType: e.target.value as AudioZone["speakerType"] })}>{["In-Ceiling","In-Wall","Invisible","Passive Soundbar","On-Wall","Outdoor"].map((v) => <option key={v}>{v}</option>)}</select></label>
                <label className="field"><span>Speaker count</span><input type="number" min="1" value={zone.speakerCount} onChange={(e) => updateZone(zone.id, { speakerCount: Number(e.target.value) || 0 })} /></label>
                <label className="field"><span>Amplification</span><select value={zone.amplification} onChange={(e) => updateZone(zone.id, { amplification: e.target.value as AudioZone["amplification"] })}>{["Sonos Amp","AVR / Marantz","DSP / Multi-Channel Amp","Powered Speaker","TBD"].map((v) => <option key={v}>{v}</option>)}</select></label>
                <label className="field"><span>Client control</span><select value={zone.control} onChange={(e) => updateZone(zone.id, { control: e.target.value as AudioZone["control"] })}>{["Savant","Sonos","Native App","Mixed","TBD"].map((v) => <option key={v}>{v}</option>)}</select></label>
              </div>

              <label className="check-row">
                <input type="checkbox" checked={zone.subwoofer} onChange={(e) => updateZone(zone.id, { subwoofer: e.target.checked })} />
                <span>Include subwoofer / low-frequency solution</span>
              </label>

              <label className="field"><span>Notes</span><textarea rows={2} value={zone.notes} onChange={(e) => updateZone(zone.id, { notes: e.target.value })} /></label>

              {!!warnings.length && <div className="warning-list">{warnings.map((warning) => <p key={warning}>⚠ {warning}</p>)}</div>}
            </article>
          );
        })}
      </div>
    </div>
  );
}
