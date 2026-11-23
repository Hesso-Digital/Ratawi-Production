import { TRAJECTORY } from '../../data/defaults';

export function PlaybackBar({ progress }: { progress: number }) {
  const pct = Math.min(100, Math.max(0, progress * 100));
  return (
    <div className="reveal-playback">
      <div className="k">Playback · The story · Jun 2026 → Apr 2027</div>
      <div className="scrub">
        <div className="f" style={{ width: `${pct}%` }} />
        <div className="h" style={{ left: `${pct}%` }} />
      </div>
      <div className="months">
        {TRAJECTORY.map((m) => (
          <span key={m.key}>{m.label}</span>
        ))}
      </div>
    </div>
  );
}
