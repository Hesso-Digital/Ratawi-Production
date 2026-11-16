import { useMemo, useState, type FormEvent } from 'react';
import { HeaderBar } from '../components/HeaderBar';
import { OPERATOR_PIN } from '../config';
import { BASELINE, STEP_1, STEP_2 } from '../data/defaults';
import { useCeremonyStore } from '../data/store';
import type { Snapshot } from '../data/types';

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

export function OperatorPage() {
  const gate = useUnlocked();
  const store = useCeremonyStore();
  const [draft, setDraft] = useState<Snapshot>(store.snapshot);

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

  return (
    <>
      <HeaderBar />
      <div className="operator">
        <section className="panel" style={{ padding: 28 }} data-entrance>
          <div className="eyebrow">Hidden operator route</div>
          <h2>Ceremony control</h2>
          <p className="lead">
            Changes appear on the audience display in other windows on this machine. The audience
            screen never shows these controls.
          </p>
          <div className="op-grid">
            {fields.map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  type="number"
                  step="any"
                  value={draft[key]}
                  onChange={(e) => setNum(key, e.target.value)}
                />
              </label>
            ))}
          </div>
          <div className="op-actions">
            <button className="btn primary" type="button" onClick={() => store.applySnapshot(draft, store.step)}>
              Apply values
            </button>
            <button
              className="btn"
              type="button"
              onClick={() => {
                setDraft(STEP_1);
                store.applySnapshot(STEP_1, 1);
              }}
            >
              Step 1
            </button>
            <button
              className="btn"
              type="button"
              onClick={() => {
                setDraft(STEP_2);
                store.applySnapshot(STEP_2, 2);
              }}
            >
              Step 2
            </button>
            <button className="btn" type="button" onClick={store.playStory}>
              {store.playback.playing ? 'Playing June to December' : 'Play June to December'}
            </button>
            <button
              className="btn"
              type="button"
              onClick={() => {
                store.reset();
                setDraft(BASELINE);
              }}
            >
              Reset
            </button>
          </div>
          <p className="assumption">
            Step 2 gas is set to 50 MMscfd. The brief says 50+ and the earlier prototype used 40.
            Confirm this figure before the ceremony.
          </p>
        </section>
        <section className="panel" style={{ padding: 28 }}>
          <div className="eyebrow">Live snapshot</div>
          <h2>What the hall can see</h2>
          <p className="lead">
            Oil {store.display.oil.toFixed(1)} kbopd  ·  Wells {Math.round(store.display.wells)}  ·  Export{' '}
            {store.display.exportKbopd.toFixed(1)}  ·  Gas {store.display.gas.toFixed(0)} MMscfd
          </p>
          <p className="note">
            Current step: {store.step === 0 ? 'baseline' : `step ${store.step}`}. Playback{' '}
            {store.playback.playing ? 'running' : 'idle'}. Data origin is mock, ready to swap for PI
            Vision later.
          </p>
          <p className="note">
            Open a second window at the site root for the audience view, then drive the ceremony from
            this page.
          </p>
        </section>
      </div>
    </>
  );
}
