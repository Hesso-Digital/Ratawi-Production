import type { SceneState } from '../../scene/ceremonyTimeline';

const STEPS = [
  { k: 'Today', v: '105', unit: 'kbopd' },
  { k: 'Step 1 · Valves open', v: '110', unit: 'kbopd' },
  { k: 'Step 2 · AGUP + gas', v: '120', unit: 'kbopd' },
  { k: 'Milestone', v: '120+', unit: 'above AGUP target' },
];

export function StepTracker({ state }: { state: SceneState }) {
  return (
    <div className="reveal-steps">
      {STEPS.map((s, i) => (
        <div key={s.k} className={`reveal-step ${i < state.step ? 'done' : ''} ${i === state.step ? 'on' : ''}`}>
          <span className="dot" />
          <div className="k">{s.k}</div>
          <div className="v">
            {s.v}
            <small>{s.unit}</small>
          </div>
        </div>
      ))}
    </div>
  );
}
