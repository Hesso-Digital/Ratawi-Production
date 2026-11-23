/** Radial gauge (240° arc) with tick marks, e.g. production versus the 120 target. */
import { CHART } from './palette';

const R = 62;
const CX = 80;
const CY = 78;
const START = (-210 * Math.PI) / 180;
const SWEEP = (240 * Math.PI) / 180;

function pt(f: number, r = R) {
  const a = START + SWEEP * f;
  return [CX + Math.cos(a) * r, CY + Math.sin(a) * r] as const;
}

function arc(f0: number, f1: number) {
  const [x0, y0] = pt(f0);
  const [x1, y1] = pt(f1);
  const large = (f1 - f0) * 240 > 180 ? 1 : 0;
  return `M${x0},${y0} A${R},${R} 0 ${large} 1 ${x1},${y1}`;
}

export function Gauge({
  label,
  value,
  min = 0,
  max,
  unit,
  decimals,
  ticks = [],
  color,
}: {
  label: string;
  value: number;
  min?: number;
  max: number;
  unit: string;
  decimals: number;
  ticks?: Array<{ value: number; label: string; gold?: boolean }>;
  color: string;
}) {
  const f = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return (
    <div className="gauge" role="meter" aria-label={label} aria-valuenow={Number(value.toFixed(decimals))} aria-valuemin={min} aria-valuemax={max}>
      <svg viewBox="0 0 160 120">
        <path d={arc(0, 1)} stroke={CHART.grid} strokeWidth={10} fill="none" strokeLinecap="round" />
        {f > 0.002 ? (
          <path d={arc(0, f)} stroke={color} strokeWidth={10} fill="none" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
        ) : null}
        {ticks.map((t) => {
          const tf = (t.value - min) / (max - min);
          const [x0, y0] = pt(tf, R - 9);
          const [x1, y1] = pt(tf, R + 9);
          const [lx, ly] = pt(tf, R + 18);
          return (
            <g key={t.label}>
              <line x1={x0} y1={y0} x2={x1} y2={y1} stroke={t.gold ? CHART.gold : CHART.axis} strokeWidth={1.6} />
              <text x={lx} y={ly + 3} textAnchor="middle" className="gauge-tick" fill={t.gold ? CHART.gold : CHART.axis}>
                {t.label}
              </text>
            </g>
          );
        })}
        <text x={CX} y={CY + 4} textAnchor="middle" className="gauge-value">
          {value.toFixed(decimals)}
        </text>
        <text x={CX} y={CY + 20} textAnchor="middle" className="gauge-unit">
          {unit}
        </text>
      </svg>
      <div className="gauge-label">{label}</div>
    </div>
  );
}
