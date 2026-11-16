import { BUDGET_KBOPD, TARGET_KBOPD, TODAY_INDEX, TRAJECTORY } from '../data/defaults';

const W = 1800;
const H = 150;
const PAD = { l: 48, r: 16, t: 16, b: 28 };
const maxY = 140;

function xAt(i: number) {
  return PAD.l + (i / (TRAJECTORY.length - 1)) * (W - PAD.l - PAD.r);
}
function yAt(v: number) {
  return PAD.t + (1 - v / maxY) * (H - PAD.t - PAD.b);
}
function poly(key: 'oil' | 'exportKbopd', from: number, to: number) {
  return TRAJECTORY.slice(from, to + 1)
    .map((p, n) => `${xAt(from + n).toFixed(1)},${yAt(p[key]).toFixed(1)}`)
    .join(' ');
}

export function TrajectoryChart({ progress, playing }: { progress: number; playing: boolean }) {
  const cursor = playing ? progress * 6 : TODAY_INDEX;
  const cx = xAt(cursor);
  const actualOil = poly('oil', 0, TODAY_INDEX);
  const forecastOil = poly('oil', TODAY_INDEX, TRAJECTORY.length - 1);
  const actualExp = poly('exportKbopd', 0, TODAY_INDEX);
  const forecastExp = poly('exportKbopd', TODAY_INDEX, TRAJECTORY.length - 1);
  const area = `${actualOil} ${xAt(TODAY_INDEX).toFixed(1)},${yAt(0).toFixed(1)} ${xAt(0).toFixed(1)},${yAt(0).toFixed(1)}`;

  return (
    <section className="panel chart-panel" data-entrance>
      <div className="chart-top">
        <div className="eyebrow">Production trajectory  ·  Jun 2026 to Apr 2027</div>
        <div className="chart-legend">
          <span>
            <b style={{ color: 'var(--ratawi-cyan)' }}>Oil</b> actual / forecast
          </span>
          <span>
            <b style={{ color: 'var(--ratawi-export)' }}>Export</b>
          </span>
          <span>Budget 90  ·  Target 120</span>
        </div>
      </div>
      <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Oil and export trajectory">
        <line x1={PAD.l} y1={yAt(BUDGET_KBOPD)} x2={W - PAD.r} y2={yAt(BUDGET_KBOPD)} stroke="rgba(245,158,11,0.45)" strokeDasharray="6 6" strokeWidth="1.2" />
        <line x1={PAD.l} y1={yAt(TARGET_KBOPD)} x2={W - PAD.r} y2={yAt(TARGET_KBOPD)} stroke="rgba(245,208,122,0.7)" strokeDasharray="6 6" strokeWidth="1.2" />
        <text x={PAD.l - 6} y={yAt(BUDGET_KBOPD) + 3} textAnchor="end" fill="#f59e0b" fontSize="10">90</text>
        <text x={PAD.l - 6} y={yAt(TARGET_KBOPD) + 3} textAnchor="end" fill="#f5d07a" fontSize="10">120</text>
        <polygon points={area} fill="rgba(43,231,255,0.08)" />
        <polyline points={actualOil} fill="none" stroke="#2be7ff" strokeWidth="2.4" />
        <polyline points={forecastOil} fill="none" stroke="#2be7ff" strokeWidth="2.2" strokeDasharray="7 6" opacity="0.85" />
        <polyline points={actualExp} fill="none" stroke="#7fe3c4" strokeWidth="1.7" />
        <polyline points={forecastExp} fill="none" stroke="#7fe3c4" strokeWidth="1.6" strokeDasharray="7 6" opacity="0.8" />
        {TRAJECTORY.map((p, i) => (
          <g key={p.key}>
            <text x={xAt(i)} y={H - 6} textAnchor="middle" fill="#6f8a97" fontSize="11">
              {p.label}
              {p.year === 2027 && i === 7 ? ' 27' : ''}
            </text>
          </g>
        ))}
        <line x1={cx} y1={PAD.t} x2={cx} y2={H - PAD.b} stroke="rgba(232,238,242,0.45)" strokeWidth="1.2" />
        <circle cx={cx} cy={yAt(playing ? lerpOil(cursor) : TRAJECTORY[TODAY_INDEX].oil)} r="4.5" fill="#2be7ff" stroke="#06111c" strokeWidth="1.5" />
      </svg>
    </section>
  );
}

function lerpOil(idx: number) {
  const lo = Math.max(0, Math.min(TRAJECTORY.length - 1, Math.floor(idx)));
  const hi = Math.min(TRAJECTORY.length - 1, lo + 1);
  const t = idx - lo;
  return TRAJECTORY[lo].oil + (TRAJECTORY[hi].oil - TRAJECTORY[lo].oil) * t;
}
