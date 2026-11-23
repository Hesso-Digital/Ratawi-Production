import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { HeaderBar } from '../components/HeaderBar';
import { OPERATOR_PIN } from '../config';
import { BASELINE, STEP_1, STEP_2 } from '../data/defaults';
import { BEATS, SCENARIO_CHAPTERS } from '../data/scenario';
import { useCeremonyStore } from '../data/store';
import { QUALITY_PROFILES } from '../scene/quality';
import { useLiveScene } from '../scene/useLiveScene';
import type { CueKind, Quality, Snapshot, ViewMode } from '../data/types';

const UNLOCK_KEY = 'ratawi_operator_unlocked';

function useUnlocked() {
  const [ok, setOk] = useState(() => sessionStorage.getItem(UNLOCK_KEY) === '1');
  return {
    ok,
    unlock: () => {
      sessionStorage.setItem(UNLOCK_KEY, '1');
      setOk(true);
    },
  };
}

function PinGate({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState('');
  const [err, setErr] = useState(false);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (pin.trim() === OPERATOR_PIN) onUnlock();
    else setErr(true);
  };
  return (
    <div className="pin-wrap">
      <form className="panel pin-gate" onSubmit={submit}>
        <div className="eyebrow">Operator console</div>
        <h2>Enter access PIN</h2>
        <p className="lead">This page is hidden from the audience display.</p>
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          value={pin}
          onChange={(e) => {
            setPin(e.target.value);
            setErr(false);
          }}
          aria-label="Operator PIN"
        />
        {err ? <p className="assumption">PIN not recognised.</p> : null}
        <button className="btn primary" type="submit">
          Unlock
        </button>
      </form>
    </div>
  );
}

const BEAT_JUMPS: Array<{ label: string; kind: CueKind; offsetS: number }> = [
  { label: 'Establishing shot', kind: 'idle', offsetS: 0 },
  { label: 'Step 1 · valves opening', kind: 'step1', offsetS: 0.8 },
  { label: 'Step 1 · oil climbing to 110', kind: 'step1', offsetS: 2.4 },
  { label: 'Step 1 · settled at 110', kind: 'step1', offsetS: 4.6 },
  { label: 'Countdown · 3', kind: 'countdown', offsetS: 0 },
  { label: 'Countdown · 1', kind: 'countdown', offsetS: 1.7 },
  { label: 'Step 2 · AGUP wells online', kind: 'step2', offsetS: 0.8 },
  { label: 'Step 2 · gas to AG-25', kind: 'step2', offsetS: 2.6 },
  { label: 'Step 2 · 120 gold moment', kind: 'step2', offsetS: 3.9 },
  { label: 'Replay · mid-way', kind: 'playback', offsetS: 4.5 },
];

export function OperatorPage() {
  const gate = useUnlocked();
  const store = useCeremonyStore();
  const [draft, setDraft] = useState<Snapshot>(store.snapshot);
  const preview = useLiveScene(store.cue, store.prevSnapshot, store.snapshot, 150);
  const timers = useRef<number[]>([]);

  // Prefetch the 3D reveal chunk as soon as the operator opens the console, so
  // the audience's first "Reveal" switch doesn't wait on a cold import.
  useEffect(() => {
    void import('./RevealAudience');
  }, []);

  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);

  const fields = useMemo(
    () =>
      [
        ['oil', 'Oil, kbopd', 1],
        ['wells', 'Wells online', 0],
        ['exportKbopd', 'Oil export, kbopd', 1],
        ['gas', 'Gas to AG-25, MMscfd', 0],
        ['bsw', 'BSW, %', 2],
        ['salt', 'Salt, mg/l', 0],
        ['efficiency', 'Plant efficiency, %', 1],
      ] as const,
    [],
  );

  if (!gate.ok) {
    return (
      <>
        <HeaderBar />
        <PinGate onUnlock={gate.unlock} />
      </>
    );
  }

  const setNum = (key: keyof Snapshot, raw: string) => {
    const n = Number(raw);
    setDraft((d) => ({ ...d, [key]: Number.isFinite(n) ? n : 0 }));
  };

  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  };

  const runStep1 = () => {
    clearTimers();
    setDraft(STEP_1);
    store.runStep1();
  };

  const runCountdown = () => {
    clearTimers();
    setDraft(STEP_2);
    store.runCountdown();
  };

  const runStep2 = () => {
    clearTimers();
    setDraft(STEP_2);
    store.runStep2();
  };

  const runFullCeremony = () => {
    runStep1();
    const id = window.setTimeout(runCountdown, (BEATS.countdownStart - BEATS.step1Start) * 1000);
    timers.current.push(id);
  };

  return (
    <>
      <HeaderBar />
      <div className="operator">
        <section className="panel" style={{ padding: 28 }} data-entrance>
          <div className="eyebrow">Hidden operator route</div>
          <h2>Ceremony control</h2>
          <p className="lead">
            Changes appear on the audience display in other windows on this machine. The audience screen
            never shows these controls.
          </p>

          <div className="op-section-label">Ceremony sequence</div>
          <div className="op-actions">
            <button className="btn primary" type="button" onClick={runStep1}>
              1 · Step 1 · Valves open
            </button>
            <button className="btn primary" type="button" onClick={runCountdown}>
              2 · Countdown 3 · 2 · 1
            </button>
            <button className="btn" type="button" onClick={runStep2}>
              Step 2 now (skip countdown)
            </button>
            <button
              className="btn"
              type="button"
              onClick={() => {
                clearTimers();
                store.playStory();
              }}
            >
              3 · Replay June to December
            </button>
            <button
              className="btn"
              type="button"
              onClick={() => {
                clearTimers();
                store.reset();
                setDraft(BASELINE);
              }}
            >
              Reset
            </button>
          </div>
          <p className="note">
            Click Step 1, then start the countdown on the narrator&apos;s &quot;three&quot;. Step 2 follows the countdown
            by itself.
          </p>

          <div className="op-section-label">Rehearsal</div>
          <div className="op-actions">
            <button className="btn" type="button" onClick={runFullCeremony}>
              Run the whole ceremony
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
          </div>

          <div className="op-section-label">Display</div>
          <div className="op-row">
            <label className="op-field">
              View
              <select value={store.view} onChange={(e) => store.setView(e.target.value as ViewMode)}>
                <option value="reveal">Reveal (3D)</option>
                <option value="classic">Classic (SVG grid)</option>
                <option value="fallback">Fallback (minimal 2D)</option>
              </select>
            </label>
            <label className="op-field">
              Quality
              <select value={store.quality} onChange={(e) => store.setQuality(e.target.value as Quality)}>
                {Object.values(QUALITY_PROFILES).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="op-section-label">Manual override</div>
          <div className="op-grid">
            {fields.map(([key, label]) => (
              <label key={key}>
                {label}
                <input type="number" step="any" value={draft[key]} onChange={(e) => setNum(key, e.target.value)} />
              </label>
            ))}
          </div>
          <div className="op-actions">
            <button
              className="btn primary"
              type="button"
              onClick={() => {
                clearTimers();
                store.applySnapshot(draft, store.step);
              }}
            >
              Apply values
            </button>
          </div>
        </section>

        <section className="panel" style={{ padding: 28 }}>
          <div className="eyebrow">Live snapshot</div>
          <h2>What the hall can see</h2>
          <p className="lead">
            Oil {preview.oil.toFixed(1)} kbopd · Wells {Math.round(preview.wells)} · Export{' '}
            {preview.exportKbopd.toFixed(1)} · Gas {preview.gas.toFixed(0)} MMscfd
            {preview.gold > 0.5 ? ' · GOLD' : ''}
          </p>
          <p className="note">
            Cue: <b>{store.cue.kind}</b> · Step {preview.step} · View {store.view} · Quality {store.quality}.
            {preview.playback ? ` Replay ${Math.round(preview.playback.progress * 100)}%.` : ''} Values are entered
            here today and can be fed from PI Vision later.
          </p>
          <p className="note">
            Open a second window at the site root for the audience view, then drive the ceremony from this page.
          </p>

          <div className="eyebrow" style={{ marginTop: 22 }}>
            Run of show
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
