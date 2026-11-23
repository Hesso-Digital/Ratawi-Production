import type { SceneState } from '../../scene/ceremonyTimeline';

export function Compass({ state }: { state: SceneState }) {
  const [px, , pz] = state.camera.position;
  const [tx, , tz] = state.camera.target;
  const dx = tx - px;
  const dz = tz - pz;
  const angleDeg = (Math.atan2(dx, -dz) * 180) / Math.PI;

  return (
    <div className="reveal-compass">
      <div className="lbl">N</div>
      <svg viewBox="0 0 56 56" width={52} height={52}>
        <circle cx={28} cy={28} r={26} fill="none" stroke="rgba(200,220,240,.25)" />
        <g transform={`rotate(${-angleDeg} 28 28)`}>
          <path d="M28 6 L33 30 L28 26 L23 30 Z" fill="#eaf2fb" />
          <path d="M28 50 L33 30 L28 34 L23 30 Z" fill="rgba(234,242,251,.25)" />
        </g>
      </svg>
    </div>
  );
}
