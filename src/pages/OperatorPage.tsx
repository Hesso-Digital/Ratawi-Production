import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { HeaderBar } from '../components/HeaderBar';
import { OPERATOR_PIN, REVEAL_TIMINGS } from '../config';
import { BASELINE, STEP_1, STEP_2 } from '../data/defaults';
import { OPEN_INPUTS, STEP1_AUTO_FOLLOWS_COUNTDOWN } from '../data/openInputs';
import { useCeremonyStore } from '../data/store';
import { QUALITY_PROFILES } from '../scene/quality';
import { sceneStateAt } from '../scene/ceremonyTimeline';
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
  { label: 'Before (idle)', kind: 'idle', offsetS: 0 },
  { label: 'Countdown · 3', kind: 'countdown', offsetS: 0 },
  { label: 'Countdown · valves open', kind: 'countdown', offsetS: 2.3 },
  { label: 'Step 1 · climbing to 110', kind: 'step1', offsetS: 0.3 },
  { label: 'Step 1 · settled at 110', kind: 'step1', offsetS: 1.6 },
  { label: 'Step 2 · AGUP igniting', kind: 'step2', offsetS: 0.5 },
  { label: 'Step 2 · flow + gas', kind: 'step2', offsetS: 2 },
  { label: 'Step 2 · climbing to 120', kind: 'step2', offsetS: 2.2 },
  { label: 'Milestone · gold', kind: 'step2', offsetS: 4 },
];

export function OperatorPage() {
  const gate = useUnlocked();
  const store = useCeremonyStore();
  const [draft, setDraft] = useState<Snapshot>(store.snapshot);
  const [autoStep1, setAutoStep1] = useState(STEP1_AUTO_FOLLOWS_COUNTDOWN);
  const [, forceTick] = useState(0);
  const timers = useRef<number[]>([]);

  // Prefetch the 3D reveal chunk as soon as the operator opens the console, so
  // the audience's first "Reveal" switch doesn't wait on a cold import.
  useEffect(() => {
    void import('./RevealAudience');
  }, []);

  // Tick the "what the hall can see" preview at a light cadence.
  useEffect(() => {
    const id = window.setInterval(() => forceTick((n) => n + 1), 150);
    return () => window.clearInterval(id);
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

  const runCountdown = () => {
    clearTimers();
    store.startCountdown();
    if (autoStep1) {
      const id = window.setTimeout(() => {
        setDraft(STEP_1);
        store.applySnapshot(STEP_1, 1, 'step1');
      }, REVEAL_TIMINGS.countdownTotalS * 1000);
      timers.current.push(id);
    }
  };

  const runStep1 = () => {
    clearTimers();
    setDraft(STEP_1);
    store.applySnapshot(STEP_1, 1, 'step1');
  };

  const runStep2 = () => {
    clearTimers();
    setDraft(STEP_2);
    store.applySnapshot(STEP_2, 2, 'step2');
  };

  const runFullReveal = () => {
    clearTimers();
    store.startCountdown();
    const t1 = window.setTimeout(() => {
      setDraft(STEP_1);
      store.applySnapshot(STEP_1, 1, 'step1');
    }, REVEAL_TIMINGS.countdownTotalS * 1000);
    const t2 = window.setTimeout(
      () => {
        setDraft(STEP_2);
        store.applySnapshot(STEP_2, 2, 'step2');
      },
      (REVEAL_TIMINGS.countdownTotalS + REVEAL_TIMINGS.step1ClimbS + 0.4) * 1000,
    );
    timers.current.push(t1, t2);
  };

  const preview = sceneStateAt(store.cue, (Date.now() - store.cue.startedAt) / 1000, store.prevSnapshot, store.snapshot);

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
            <button className="btn primary" type="button" onClick={runCountdown}>
              Countdown 3 · 2 · 1
            </button>
            <button className="btn" type="button" onClick={runStep1}>
              Step 1 · Valves open
            </button>
            <button className="btn" type="button" onClick={runStep2}>
              Step 2 · AGUP + gas
            </button>
            <button className="btn" type="button" onClick={store.playStory}>
              {store.playback.playing ? 'Playing June to December' : 'Play June to December'}
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
          <label className="op-check">
            <input type="checkbox" checked={autoStep1} onChange={(e) => setAutoStep1(e.target.checked)} />
            Step 1 auto-follows the countdown (open input #5 — default off until the narrator timing is confirmed)
          </label>

          <div className="op-section-label">Rehearsal</div>
          <div className="op-actions">
            <button className="btn" type="button" onClick={runFullReveal}>
              Run full reveal (countdown → step 1 → step 2)
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
            Cue: <b>{store.cue.kind}</b> (t={preview.t.toFixed(2)}s) · Step {store.step} · View {store.view} · Quality{' '}
            {store.quality}. Playback {store.playback.playing ? 'running' : 'idle'}. Data origin is mock, ready to
            swap for PI Vision later.
          </p>
          <p className="note">
            Open a second window at the site root for the audience view, then drive the ceremony from this page.
          </p>

          <div className="eyebrow" style={{ marginTop: 22 }}>
            Open data inputs (integration-plan.md §10)
          </div>
          <ul className="op-inputs">
            {OPEN_INPUTS.map((input) => (
              <li key={input.id} data-status={input.status}>
                <b>
                  #{input.id} {input.title}
                </b>
                <span>{input.note}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
