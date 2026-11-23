import { useEffect, useRef } from 'react';
import { HeaderBar } from '../components/HeaderBar';
import { DataPresetsForm } from '../components/DataPresetsForm';
import { DisplaySettingsFields } from '../components/DisplaySettingsFields';
import { PlaybackBar } from '../components/reveal/PlaybackBar';
import { BEATS, SCENARIO_CHAPTERS } from '../data/scenario';
import { isAgupOnline } from '../data/presets';
import { useCeremonyStore } from '../data/store';
import { useLiveScene } from '../scene/useLiveScene';
import type { CueKind } from '../data/types';

const BEAT_JUMPS: Array<{ label: string; kind: CueKind; offsetS: number }> = [
  { label: 'Establishing shot', kind: 'idle', offsetS: 0 },
  { label: 'Valves opening', kind: 'step1', offsetS: 0.8 },
  { label: 'Oil climbing to 110', kind: 'step1', offsetS: 2.4 },
  { label: 'Settled at 110', kind: 'step1', offsetS: 4.6 },
  { label: 'AGUP wells online', kind: 'step2', offsetS: 0.8 },
  { label: 'Gas to AG-25', kind: 'step2', offsetS: 2.6 },
  { label: '120 gold moment', kind: 'step2', offsetS: 3.9 },
  { label: 'Replay mid-way', kind: 'playback', offsetS: 4.5 },
];

export function OperatorPage() {
  const store = useCeremonyStore();
  const preview = useLiveScene(store.cue, store.prevSnapshot, store.snapshot, 150, store.lines);
  const timers = useRef<number[]>([]);
  const online = isAgupOnline(store.snapshot, store.presets) || store.cue.kind === 'step2' || store.step >= 2;

  useEffect(() => {
    void import('./RevealAudience');
  }, []);

  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);

  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  };

  const runStep1 = () => {
    clearTimers();
    store.runStep1();
  };

  const runCountdown = () => {
    clearTimers();
    store.runCountdown();
  };

  const runStep2 = () => {
    clearTimers();
    store.runStep2();
  };

  const runFullCeremony = () => {
    runStep1();
    const id = window.setTimeout(runCountdown, (BEATS.countdownStart - BEATS.step1Start) * 1000);
    timers.current.push(id);
  };

  return (
    <>
      <HeaderBar alwaysShowClock />
      <div className="operator">
        <section className="panel" style={{ padding: 28 }} data-entrance>
          <div className="eyebrow">Operator console</div>
          <h2>Hall controls</h2>
          <p className="lead">
            Changes appear on the hall display in other windows on this machine. The hall screen does not show these
            controls.
          </p>

          <div className="op-section-label">Production state</div>
          <div className="admin-toggle" role="group" aria-label="Production state">
            <button type="button" className={`chip${online ? '' : ' on'}`} onClick={() => { clearTimers(); store.resetToCurrent(); }}>
              Current
            </button>
            <button type="button" className={`chip${online ? ' on' : ''}`} onClick={() => { clearTimers(); store.bringAgupOnline(); }}>
              AGUP online
            </button>
          </div>
          <div className="op-actions" style={{ marginTop: 12 }}>
            <button
              className="btn primary"
              type="button"
              onClick={() => {
                clearTimers();
                if (online) {
                  store.resetToCurrent();
                } else {
                  store.bringAgupOnline();
                }
              }}
            >
              {online ? 'Reset to current' : 'Bring AGUP online'}
            </button>
          </div>

          <div className="op-section-label">Playback</div>
          <PlaybackBar
            state={preview}
            interactive
            onPlay={() => {
              clearTimers();
              store.playStory();
            }}
            onStop={() => {
              clearTimers();
              store.stopStory();
            }}
            onScrub={store.scrubPlayback}
          />

          <div className="op-section-label">Edit KPI numbers</div>
          <DataPresetsForm presets={store.presets} onSave={store.savePresets} onResetDefaults={store.resetPresets} />

          <div className="op-section-label">Display</div>
          <div className="op-row">
            <label className="op-field">
              View
              <select value={store.view} onChange={(e) => store.setView(e.target.value as typeof store.view)}>
                <option value="reveal">Field (3D)</option>
                <option value="classic">Classic (SVG grid)</option>
                <option value="fallback">Fallback (minimal 2D)</option>
              </select>
            </label>
          </div>
          <DisplaySettingsFields
            quality={store.quality}
            settings={store.settings}
            onQuality={store.setQuality}
            onSettings={store.setSettings}
          />

          <details className="op-rehearsal">
            <summary>Rehearsal</summary>
            <div className="op-actions">
              <button className="btn" type="button" onClick={runStep1}>
                Valves open
              </button>
              <button className="btn" type="button" onClick={runCountdown}>
                Countdown
              </button>
              <button className="btn" type="button" onClick={runStep2}>
                AGUP sequence now
              </button>
              <button className="btn" type="button" onClick={runFullCeremony}>
                Run the full sequence
              </button>
              <select
                className="op-select"
                defaultValue=""
                onChange={(e) => {
                  const idx = Number(e.target.value);
                  if (Number.isNaN(idx)) return;
                  const jump = BEAT_JUMPS[idx];
                  if (jump) store.jumpToCue(jump.kind, jump.offsetS);
                  e.currentTarget.value = '';
                }}
              >
                <option value="" disabled>
                  Jump to beat…
                </option>
                {BEAT_JUMPS.map((b, i) => (
                  <option key={b.label} value={i}>
                    {b.label}
                  </option>
                ))}
              </select>
              <button
                className="btn"
                type="button"
                onClick={() => {
                  clearTimers();
                  store.reset();
                }}
              >
                Reset
              </button>
            </div>
          </details>
        </section>

        <section className="panel" style={{ padding: 28 }}>
          <div className="eyebrow">Live snapshot</div>
          <h2>What the hall can see</h2>
          <p className="lead">
            Oil {preview.oil.toFixed(1)} kbopd · Wells {Math.round(preview.wells)} · Export {preview.exportKbopd.toFixed(1)} ·
            Gas {preview.gas.toFixed(0)} MMscfd
            {preview.gold > 0.5 ? ' · GOLD' : ''}
          </p>
          <p className="note">
            State: <b>{online ? 'AGUP online' : 'Current'}</b> · View {store.view} · Quality {store.quality}.
            {preview.playback ? ` Replay ${Math.round(preview.playback.progress * 100)}%.` : ''} Values entered here update
            the hall screen on this machine.
          </p>
          <div className="eyebrow" style={{ marginTop: 22 }}>
            Sequence
          </div>
          <ul className="op-inputs">
            {SCENARIO_CHAPTERS.map((c) => (
              <li key={c.id} data-status={c.cue === store.cue.kind ? 'active' : 'idle'}>
                <b>{c.label}</b>
                <span>{c.summary}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
