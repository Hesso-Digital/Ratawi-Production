import type { SceneState } from '../../scene/ceremonyTimeline';

const CIRCUMFERENCE = 2 * Math.PI * 170;

export function CountdownRing({ state }: { state: SceneState }) {
  if (!state.countdown) return null;
  const { n, prog } = state.countdown;
  const offset = n > 0 ? CIRCUMFERENCE * (1 - prog) : 0;
  const fade = n === 0 ? Math.max(0, 1 - Math.max(0, prog - 0.6) / 0.4) : 1;

  return (
    <div className="reveal-count" style={{ opacity: fade }}>
      <svg viewBox="0 0 380 380">
        <circle cx={190} cy={190} r={170} fill="none" stroke="rgba(255,198,90,.18)" strokeWidth={2} />
        <circle
          cx={190}
          cy={190}
          r={170}
          fill="none"
          stroke="#ffc65a"
          strokeWidth={3}
          strokeLinecap="round"
          transform="rotate(-90 190 190)"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          style={{ filter: 'drop-shadow(0 0 8px #ffb347)' }}
        />
      </svg>
      {n > 0 ? (
        <div className="n">{n}</div>
      ) : (
        <div className="n word">
          Valves
          <br />
          open
        </div>
      )}
      <div className="cap">{n > 0 ? 'Opening the valves' : 'AGUP · Step 1'}</div>
      <div className="chips">
        {[3, 2, 1].map((chip) => (
          <b key={chip} className={n === 0 || chip >= n ? 'on' : ''}>
            {chip}
          </b>
        ))}
      </div>
    </div>
  );
}
