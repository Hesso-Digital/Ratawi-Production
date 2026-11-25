/**
 * Small SVG trend chart in the holographic palette: area + line, reference
 * lines (target, AGUP target, limits), a dashed neon forecast segment after
 * the latest actual month, hover tooltip per month, and a cursor that
 * follows the replay scrubber. Hand-rolled like TrajectoryChart.tsx (the app has
 * no chart library), so the hall bundle stays light.
 */
import { useState } from 'react';
import type { RefLine } from '../../../data/series';
import { CHART } from './palette';

export type LinePoint = { label: string; value: number; forecast?: boolean; year?: number };

const W = 520;
const H = 210;
const PAD = { l: 40, r: 16, t: 14, b: 26 };

export function LineChart({
  points,
  domain,
  refs = [],
  color,
  unit,
  decimals,
  cursor,
  onHover,
  forecastFrom,
}: {
  points: LinePoint[];
  domain: [number, number];
  refs?: RefLine[];
  color: string;
  unit: string;
  decimals: number;
  /** Fractional index of the scrubber / replay cursor. */
  cursor?: number;
  onHover?: (index: number | null) => void;
  /** Index of the last actual month; the line after it is drawn as the forecast. */
  forecastFrom?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const n = points.length;
  const x = (i: number) => PAD.l + (i / Math.max(1, n - 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - domain[0]) / (domain[1] - domain[0])) * (H - PAD.t - PAD.b);
  const split = forecastFrom !== undefined && forecastFrom >= 0 && forecastFrom < n - 1 ? forecastFrom : n - 1;
  const hasForecast = split < n - 1;
  const pathOf = (from: number, to: number) =>
    points
      .slice(from, to + 1)
      .map((p, k) => `${k ? 'L' : 'M'}${x(from + k).toFixed(1)},${y(p.value).toFixed(1)}`)
      .join(' ');
  const line = pathOf(0, split);
  const area = `${line} L${x(split)},${y(domain[0])} L${x(0)},${y(domain[0])} Z`;
  const fLine = hasForecast ? pathOf(split, n - 1) : '';
  const fArea = hasForecast ? `${fLine} L${x(n - 1)},${y(domain[0])} L${x(split)},${y(domain[0])} Z` : '';
  const fc = CHART.forecast;
  const gradId = `lc-${color.replace('#', '')}`;
  const fGradId = `lcf-${color.replace('#', '')}`;
  const refColor = (t: RefLine['tone']) => (t === 'target' ? CHART.gold : t === 'limit' ? CHART.red : t === 'min' ? CHART.gas : CHART.axis);

  const move = (e: React.PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const fx = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((fx - PAD.l) / (W - PAD.l - PAD.r)) * (n - 1));
    const idx = Math.max(0, Math.min(n - 1, i));
    setHover(idx);
    onHover?.(idx);
  };
  const leave = () => {
    setHover(null);
    onHover?.(null);
  };

  const ticks = [domain[0], (domain[0] + domain[1]) / 2, domain[1]];
  const hp = hover !== null ? points[hover] : null;

  return (
    <div className="lc">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Trend chart">
        <defs>
          <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.32" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
          <linearGradient id={fGradId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={fc} stopOpacity="0.22" />
            <stop offset="100%" stopColor={fc} stopOpacity="0" />
          </linearGradient>
        </defs>
        {hasForecast ? (
          <g className="lc-forecast-zone">
            <rect x={x(split)} y={PAD.t} width={x(n - 1) - x(split)} height={H - PAD.t - PAD.b} fill={fc} opacity={0.05} />
            <line x1={x(split)} x2={x(split)} y1={PAD.t} y2={H - PAD.b} stroke={fc} strokeOpacity={0.45} strokeDasharray="2 4" />
          </g>
        ) : null}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke={CHART.grid} />
            <text x={PAD.l - 8} y={y(t) + 4} textAnchor="end" className="lc-tick">
              {t % 1 ? t.toFixed(2) : t}
            </text>
          </g>
        ))}
        {points.map((p, i) => (
          <text key={p.label} x={x(i)} y={H - 6} textAnchor="middle" className="lc-tick">
            {p.label}
          </text>
        ))}
        <path d={area} fill={`url(#${gradId})`} />
        <path d={line} fill="none" stroke={color} strokeWidth={2.4} style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
        {hasForecast ? (
          <g className="lc-forecast">
            <path d={fArea} fill={`url(#${fGradId})`} />
            <path d={fLine} fill="none" stroke={fc} strokeWidth={2.4} strokeDasharray="7 5" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 6px ${fc})` }} />
          </g>
        ) : null}
        {refs.map((r) => (
          <g key={r.label}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(r.value)} y2={y(r.value)} stroke={refColor(r.tone)} strokeDasharray="5 5" strokeWidth={1.2} />
            <text x={W - PAD.r} y={y(r.value) - 5} textAnchor="end" className="lc-ref" fill={refColor(r.tone)}>
              {r.label}
            </text>
          </g>
        ))}
        {points.map((p, i) => (
          <circle
            key={p.label}
            cx={x(i)}
            cy={y(p.value)}
            r={hover === i ? 5 : 3}
            fill={hasForecast && i > split ? '#0a0b10' : color}
            stroke={hasForecast && i > split ? fc : color}
            strokeWidth={1.5}
          />
        ))}
        {cursor !== undefined ? (
          <g>
            <line x1={x(cursor)} x2={x(cursor)} y1={PAD.t} y2={H - PAD.b} stroke={CHART.gold} strokeWidth={1.4} />
            <circle cx={x(cursor)} cy={PAD.t} r={4} fill={CHART.gold} />
          </g>
        ) : null}
        {hasForecast ? (
          <g className="lc-legend" transform={`translate(${PAD.l + 8}, ${PAD.t + 10})`}>
            <line x1={0} x2={16} y1={0} y2={0} stroke={color} strokeWidth={2.4} />
            <text x={22} y={3.5} className="lc-ref" fill={CHART.text}>
              Actual
            </text>
            <line x1={70} x2={86} y1={0} y2={0} stroke={fc} strokeWidth={2.4} strokeDasharray="5 3" />
            <text x={92} y={3.5} className="lc-ref" fill={fc}>
              Forecast
            </text>
          </g>
        ) : null}
        <rect x={PAD.l} y={PAD.t} width={W - PAD.l - PAD.r} height={H - PAD.t - PAD.b} fill="transparent" onPointerMove={move} onPointerLeave={leave} />
      </svg>
      {hp && hover !== null ? (
        <div className="lc-tip" style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(hp.value) / H) * 100}%` }}>
          <b>
            {hp.value.toFixed(decimals)}
            <small>{unit}</small>
          </b>
          <span>
            {hp.label} {hp.year ?? 2026}
            {hasForecast && hover > split ? <em className="lc-tip-forecast"> · Forecast</em> : null}
          </span>
        </div>
      ) : null}
    </div>
  );
}
