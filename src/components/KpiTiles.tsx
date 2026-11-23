import { useCountUp } from '../hooks/useCountUp';
import { KPIS_WITHOUT_OIL } from '../data/kpis';
import type { Snapshot } from '../data/types';

function Tile({
  label,
  value,
  decimals,
  unit,
  sub,
  alert,
  tone,
}: {
  label: string;
  value: number;
  decimals: number;
  unit: string;
  sub?: string;
  alert?: boolean;
  tone?: 'default' | 'gold' | 'gas';
}) {
  const ref = useCountUp<HTMLSpanElement>(value, { decimals, durationS: 0.42 });
  return (
    <article
      className="panel tile"
      data-entrance
      data-alert={alert ? 'true' : 'false'}
      data-live-gas={tone === 'gas' ? 'true' : 'false'}
    >
      <div className="eyebrow">{label}</div>
      <div>
        <div className="value">
          <span ref={ref}>{value.toFixed(decimals)}</span>
          <span className="unit">{unit}</span>
        </div>
        {sub ? <div className="sub">{sub}</div> : null}
      </div>
    </article>
  );
}

export function KpiTiles({ data }: { data: Snapshot }) {
  return (
    <div className="tiles">
      {KPIS_WITHOUT_OIL.map((kpi) => (
        <Tile
          key={kpi.id}
          label={kpi.label}
          value={kpi.value(data)}
          decimals={kpi.decimals}
          unit={kpi.unit}
          sub={kpi.sub(data)}
          alert={kpi.alert?.(data)}
          tone={kpi.tone?.(data)}
        />
      ))}
    </div>
  );
}
