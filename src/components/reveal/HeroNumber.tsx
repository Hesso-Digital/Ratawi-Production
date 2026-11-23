import { WORDING } from '../../data/ceremonyConfig';
import { BUDGET_KBOPD, TARGET_KBOPD } from '../../data/defaults';
import type { SceneState } from '../../scene/ceremonyTimeline';

function HeroDrop({ gold }: { gold: boolean }) {
  const stroke = gold ? '#f5d07a' : '#2be7ff';
  const fill = gold ? 'rgba(245,208,122,.35)' : 'rgba(43,231,255,.15)';
  return (
    <svg viewBox="0 0 18 24" width={18} height={24} aria-hidden="true">
      <path
        d="M9 1C9 1 1.5 10.5 1.5 15.5a7.5 7.5 0 0 0 15 0C16.5 10.5 9 1 9 1Z"
        fill={fill}
        stroke={stroke}
        strokeWidth={1.6}
      />
    </svg>
  );
}

export function HeroNumber({ state }: { state: SceneState }) {
  const gold = state.gold > 0.5;
  const fillPct = Math.min(100, (state.oil / 140) * 100);
  const tickPct = (v: number) => (v / 140) * 100;
  const statusText = gold
    ? 'Above target · 120 kbopd reached'
    : state.step >= 2
      ? `AGUP coming online · +${(state.oil - BUDGET_KBOPD).toFixed(1)} vs ${WORDING.commitmentLabel.toLowerCase()}`
      : state.step === 1
        ? `Valves open · +${(state.oil - BUDGET_KBOPD).toFixed(1)} vs ${WORDING.commitmentLabel.toLowerCase()}`
        : state.oil > BUDGET_KBOPD
          ? `Above ${WORDING.commitmentLabel.toLowerCase()} · +${(state.oil - BUDGET_KBOPD).toFixed(1)}`
          : `Ramping to ${WORDING.commitmentLabel.toLowerCase()} · ${state.oil.toFixed(1)} of ${BUDGET_KBOPD}`;

  return (
    <div className="reveal-hero">
      <div className="label">
        <HeroDrop gold={gold} />
        <span>Oil production · Daily</span>
      </div>
      <div className="big">
        <span className="n">{state.oil.toFixed(1)}</span>
        <span className="u">kbopd</span>
      </div>
      <div className="scale">
        <div className="track" />
        <div className="fill" style={{ width: `${fillPct}%` }} />
        <div className="tick" style={{ left: `${tickPct(0)}%` }}>
          <span>0</span>
        </div>
        <div className="tick" style={{ left: `${tickPct(BUDGET_KBOPD)}%` }}>
          <span>{BUDGET_KBOPD} · {WORDING.commitmentLabel}</span>
        </div>
        <div className="tick target" style={{ left: `${tickPct(TARGET_KBOPD)}%` }}>
          <span>{TARGET_KBOPD} · {WORDING.targetLabel}</span>
        </div>
      </div>
      <div className="status">
        <i />
        <span>{statusText}</span>
      </div>
    </div>
  );
}
