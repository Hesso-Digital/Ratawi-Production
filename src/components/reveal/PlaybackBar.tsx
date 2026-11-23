import { PLAYBACK_END_INDEX, TRAJECTORY } from '../../data/defaults';
import type { SceneState } from '../../scene/ceremonyTimeline';

const MONTHS = TRAJECTORY.slice(0, PLAYBACK_END_INDEX + 1);

export function PlaybackBar({ state }: { state: SceneState }) {
  const progress = state.playback?.progress ?? 0;
  const index = state.playback?.index ?? 0;
  const pct = Math.min(100, Math.max(0, progress * 100));
  const current = MONTHS[Math.min(PLAYBACK_END_INDEX, Math.round(index))];
  return (
    <div className="reveal-playback">
      <div className="k">
        Replay · {current.label} {current.year}
      </div>
      <div className="scrub">
        <div className="f" style={{ width: `${pct}%` }} />
        <div className="h" style={{ left: `${pct}%` }} />
      </div>
      <div className="months">
        {MONTHS.map((m, i) => (
          <span key={m.key} style={{ opacity: i <= index + 0.5 ? 1 : 0.4 }}>
            {m.label}
          </span>
        ))}
      </div>
    </div>
  );
}
