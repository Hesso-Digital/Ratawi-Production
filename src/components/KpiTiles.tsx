import { useCountUp } from '../hooks/useCountUp';
import { LIMITS } from '../data/defaults';
import type { Snapshot } from '../data/types';

function Tile({
  label,
  value,
  decimals,
  unit,
  sub,
  alert,
  liveGas,
}: {
  label: string;
  value: number;
  decimals: number;
  unit: string;
  sub?: string;
  alert?: boolean;
  liveGas?: boolean;
}) {
  const ref = useCountUp<HTMLSpanElement>(value, { decimals, durationS: 0.8 });
  return (
    <article
      className="panel tile"
      data-entrance
      data-alert={alert ? 'true' : 'false'}
      data-live-gas={liveGas ? 'true' : 'false'}
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
  const bswAlert = data.bsw >= LIMITS.bsw;
  const saltAlert = data.salt >= LIMITS.salt;
  const gasLive = data.gas >= 5;
  return (
    <div className="tiles">
      <Tile
        label="Wells online"
        value={data.wells}
        decimals={0}
        unit=""
        sub={data.wells >= 31.5 ? '32 wells after AGUP hookup' : data.wells >= 24.5 && data.wells < 26 ? '25 wells online' : undefined}
      />
      <Tile label="Oil export" value={data.exportKbopd} decimals={1} unit="KBOPD" />
      <Tile
        label="Gas to AG-25"
        value={data.gas}
        decimals={0}
        unit="MMSCFD"
        liveGas={gasLive}
        sub={gasLive ? 'Export line live' : 'Awaiting AGUP gas'}
      />
      <Tile
        label="BSW"
        value={data.bsw}
        decimals={2}
        unit="%"
        alert={bswAlert}
        sub={`Limit ${LIMITS.bsw}%`}
      />
      <Tile
        label="Salt"
        value={data.salt}
        decimals={0}
        unit="mg/l"
        alert={saltAlert}
        sub={`Limit ${LIMITS.salt} mg/l`}
      />
      <Tile label="Plant efficiency" value={data.efficiency} decimals={1} unit="%" />
    </div>
  );
}
