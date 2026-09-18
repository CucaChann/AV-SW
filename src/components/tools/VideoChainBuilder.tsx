import {
  exportCsv,
  newVideoChain,
  videoChainWarnings,
  type ProjectToolsState,
  type VideoChain,
} from "../../lib/projectTools";

type Props = {
  state: ProjectToolsState;
  onChange: (state: ProjectToolsState) => void;
};

export default function VideoChainBuilder({ state, onChange }: Props) {
  const addChain = () =>
    onChange({ ...state, videoChains: [...state.videoChains, newVideoChain()] });

  const updateChain = (id: string, patch: Partial<VideoChain>) =>
    onChange({
      ...state,
      videoChains: state.videoChains.map((chain) =>
        chain.id === id ? { ...chain, ...patch } : chain,
      ),
    });

  const removeChain = (id: string) =>
    onChange({
      ...state,
      videoChains: state.videoChains.filter((chain) => chain.id !== id),
    });

  const exportRfq = () =>
    exportCsv("av-sw-video-custom-rfq.csv", [
      ["Room","Display Brand","Display Model","Source","Control","Audio","Transport","Mount","Network","Notes"],
      ...state.videoChains.map((chain) => [
        chain.room,
        chain.displayBrand,
        chain.displayModel,
        chain.source,
        chain.control,
        chain.audio,
        chain.transport,
        chain.mount,
        chain.network ? "Yes" : "No",
        chain.notes,
      ]),
    ]);

  return (
    <div className="tool-page">
      <div className="tool-page-heading">
        <div>
          <span className="eyebrow">Compatibility Chain</span>
          <h1>Video + Control Builder</h1>
          <p>
            Build the whole endpoint: panel, source, Savant/control path, audio, transport, network and mounting.
          </p>
        </div>
        <div className="tool-action-row">
          <button className="primary" onClick={addChain}>+ Add Video System</button>
          <button onClick={exportRfq} disabled={!state.videoChains.length}>Export RFQ CSV</button>
        </div>
      </div>

      {!state.videoChains.length && <div className="tool-empty">Add a video system to start with Sony/Samsung/other displays, Apple TV, Savant, Leon/Sonos/AVR and mounting.</div>}

      <div className="builder-list">
        {state.videoChains.map((chain, index) => {
          const warnings = videoChainWarnings(chain);
          return (
            <article className="builder-card" key={chain.id}>
              <div className="builder-card-header">
                <div><span className="eyebrow">System {index + 1}</span><h3>{chain.room || "Unassigned room"}</h3></div>
                <button onClick={() => removeChain(chain.id)}>Remove</button>
              </div>

              <div className="builder-form-grid three">
                <label className="field"><span>Room</span><input value={chain.room} onChange={(e) => updateChain(chain.id, { room: e.target.value })} /></label>
                <label className="field"><span>Display brand</span><select value={chain.displayBrand} onChange={(e) => updateChain(chain.id, { displayBrand: e.target.value as VideoChain["displayBrand"] })}>{["Sony","Samsung","Other","TBD"].map((v) => <option key={v}>{v}</option>)}</select></label>
                <label className="field"><span>Display model / size</span><input value={chain.displayModel} placeholder="e.g. 85 in / exact model later" onChange={(e) => updateChain(chain.id, { displayModel: e.target.value })} /></label>
                <label className="field"><span>Source</span><select value={chain.source} onChange={(e) => updateChain(chain.id, { source: e.target.value as VideoChain["source"] })}>{["Apple TV","Cable / Satellite","Blu-ray","Local / Streaming Apps","None"].map((v) => <option key={v}>{v}</option>)}</select></label>
                <label className="field"><span>Control</span><select value={chain.control} onChange={(e) => updateChain(chain.id, { control: e.target.value as VideoChain["control"] })}>{["Savant IP","Savant IR","CEC","Native Remote","Other","TBD"].map((v) => <option key={v}>{v}</option>)}</select></label>
                <label className="field"><span>Audio</span><select value={chain.audio} onChange={(e) => updateChain(chain.id, { audio: e.target.value as VideoChain["audio"] })}>{["Leon Passive Soundbar","Sonos Arc","AVR / Surround","TV Audio","Other","TBD"].map((v) => <option key={v}>{v}</option>)}</select></label>
                <label className="field"><span>Video transport</span><select value={chain.transport} onChange={(e) => updateChain(chain.id, { transport: e.target.value as VideoChain["transport"] })}>{["HDMI","Fiber HDMI","HDBaseT / Extender","Local"].map((v) => <option key={v}>{v}</option>)}</select></label>
                <label className="field"><span>Mount</span><select value={chain.mount} onChange={(e) => updateChain(chain.id, { mount: e.target.value as VideoChain["mount"] })}>{["Fixed","Articulating","Future Automation","TBD"].map((v) => <option key={v}>{v}</option>)}</select></label>
              </div>

              <label className="check-row">
                <input type="checkbox" checked={chain.network} onChange={(e) => updateChain(chain.id, { network: e.target.checked })} />
                <span>Provide reliable network at the video endpoint</span>
              </label>

              <label className="field"><span>Notes / custom enclosure / TV frame</span><textarea rows={2} value={chain.notes} onChange={(e) => updateChain(chain.id, { notes: e.target.value })} /></label>

              {!!warnings.length && <div className="warning-list">{warnings.map((warning) => <p key={warning}>⚠ {warning}</p>)}</div>}
            </article>
          );
        })}
      </div>
    </div>
  );
}
