import type { SceneState } from '../../scene/ceremonyTimeline';

const CIRCUMFERENCE = 2 * Math.PI * 170;

export function CountdownRing({ state }: { state: SceneState }) {
  if (!state.countdown) return null;
  const { n, prog } = state.countdown;
  const offset = CIRCUMFERENCE * (1 - prog);
  const fade = 1;

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
      <div className="n">{n}</div>
      <div className="cap">AGUP · Step 2</div>
      <div className="chips">
        {[3, 2, 1].map((chip) => (
          <b key={chip} className={chip >= n ? 'on' : ''}>
            {chip}
          </b>
        ))}
      </div>
    </div>
  );
}
