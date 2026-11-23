/**
 * KPI detail drawer: opens from a KPI tile (or the hero number) in explore
 * mode. Trend charts with commitment / target / limit lines, gauges, and for
 * wells the clickable well status chart. Oil uses the June 2026–April 2027
 * viewer timeline (Play / Pause / Live), not the admin ceremony replay.
 */
import { KPIS, type KpiId } from '../../../data/kpis';
import { KPI_SERIES, MONTHS, TIMELINE_MONTHS, TODAY_INDEX, valueAt } from '../../../data/series';
import { asOfStore, useAsOfState } from '../../../data/asOfStore';
import { BUDGET_KBOPD, GAS_MIN_TO_OPERATE_MMSCFD, LIMITS, TARGET_KBOPD } from '../../../data/defaults';
import { useCeremonyStore } from '../../../data/store';
import type { SceneState } from '../../../scene/ceremonyTimeline';
import { exploreStore } from '../../../scene/explore/exploreStore';
import { CountText } from '../../CountText';
import { OilCompare, OilTimeline } from '../OilTimeline';
import { Gauge } from './Gauge';
import { LineChart } from './LineChart';
import { WellStatusChart } from './WellStatusChart';
import { CHART, toneColor } from './palette';

const FOCUS: Record<KpiId, { kind: 'asset' | 'preset'; id: string; label: string }> = {
  oil: { kind: 'asset', id: 'cpf1', label: 'Show CPF-1' },
  wells: { kind: 'preset', id: 'agup', label: 'Show AGUP wells' },
  export: { kind: 'asset', id: 'export-line', label: 'Show export line' },
  gas: { kind: 'asset', id: 'ag25', label: 'Show AG-25' },
  bsw: { kind: 'asset', id: 'export-line', label: 'Show export line' },
  salt: { kind: 'asset', id: 'export-line', label: 'Show export line' },
  efficiency: { kind: 'asset', id: 'cpf1', label: 'Show CPF-1' },
};

function Side({ id, state, gold }: { id: KpiId; state: SceneState; gold: boolean }) {
  if (id === 'wells') return <WellStatusChart state={state} />;
  if (id === 'oil') {
    const commitment = state.commitmentKbopd ?? BUDGET_KBOPD;
    const target = state.targetKbopd ?? TARGET_KBOPD;
    return (
      <div className="drawer-side">
        <Gauge
          label="Production versus target"
          value={state.oil}
          max={130}
          unit="kbopd"
          decimals={1}
          color={gold ? CHART.gold : CHART.cyan}
          ticks={[
            { value: commitment, label: `${commitment}` },
            { value: target, label: `${target}`, gold: true },
          ]}
        />
        <OilCompare actual={state.oil} commitment={commitment} target={target} />
      </div>
    );
  }
  if (id === 'gas') {
    return (
      <div className="drawer-side">
        <Gauge
          label="Gas to AG-25"
          value={state.gas}
          max={60}
          unit="MMscfd"
          decimals={0}
          color={CHART.gas}
          ticks={[{ value: GAS_MIN_TO_OPERATE_MMSCFD, label: `min ${GAS_MIN_TO_OPERATE_MMSCFD}`, gold: true }]}
        />
        <div className="breakdown">
          <div className={`bd-row ${state.gas >= GAS_MIN_TO_OPERATE_MMSCFD ? 'on' : ''}`}>
            <span>AG-25</span>
            <b>{state.gas >= GAS_MIN_TO_OPERATE_MMSCFD ? 'Operating' : state.gas > 0 ? 'Ramping up' : 'Standby'}</b>
          </div>
        </div>
      </div>
    );
  }
  if (id === 'efficiency') {
    return (
      <div className="drawer-side">
        <Gauge label="Plant efficiency" value={state.efficiency} max={100} unit="%" decimals={1} color={CHART.cyan} />
      </div>
    );
  }
  if (id === 'bsw' || id === 'salt') {
    const limit = LIMITS[id];
    const v = state[id];
    return (
      <div className="drawer-side">
        <Gauge
          label={id === 'bsw' ? 'BSW versus limit' : 'Salt versus limit'}
          value={v}
          max={limit * 1.2}
          unit={id === 'bsw' ? '%' : 'mg/l'}
          decimals={id === 'bsw' ? 2 : 0}
          color={v >= limit ? CHART.red : CHART.cyan}
          ticks={[{ value: limit, label: `limit ${limit}` }]}
        />
        <div className="breakdown">
          <div className="bd-row on">
            <span>Headroom to limit</span>
            <b>{Math.max(0, ((limit - v) / limit) * 100).toFixed(0)}%</b>
          </div>
        </div>
      </div>
    );
  }
  // export
  return (
    <div className="drawer-side">
      <div className="breakdown wide">
        <div className="bd-row on">
          <span>Oil into CPF-1</span>
          <b><CountText value={state.oil} decimals={1} /> kbopd</b>
        </div>
        <div className="bd-row on">
          <span>Oil export, metered</span>
          <b><CountText value={state.exportKbopd} decimals={1} /> kbopd</b>
        </div>
        <div className="bd-row">
          <span>Difference</span>
          <b>{(state.oil - state.exportKbopd).toFixed(1)} kbopd</b>
        </div>
      </div>
    </div>
  );
}

export function KpiDrawer({ id, state, relatedIds }: { id: KpiId; state: SceneState; relatedIds: KpiId[] }) {
  const kpi = KPIS.find((k) => k.id === id)!;
  const series = KPI_SERIES[id];
  const presets = useCeremonyStore().presets;
  const gold = state.gold > 0.5 && (id === 'oil' || id === 'wells');
  const color = toneColor(series.tone, gold);
  const asOf = useAsOfState();
  const oilSeries = id === 'oil';
  const months = oilSeries ? TIMELINE_MONTHS : MONTHS;
  const values = oilSeries ? TIMELINE_MONTHS.map((m) => m.oil) : series.values;
  const cursor = oilSeries ? (asOf.index ?? TODAY_INDEX) : (asOf.index != null && asOf.index <= MONTHS.length - 1 ? asOf.index : TODAY_INDEX);
  const monthLabel = months[Math.min(months.length - 1, Math.round(cursor))]?.label ?? '';
  const focus = FOCUS[id];
  const oilRefs = oilSeries
    ? [
        { value: presets.commitmentKbopd, label: `Commitment ${presets.commitmentKbopd}`, tone: 'commit' as const },
        { value: presets.targetKbopd, label: `Target ${presets.targetKbopd}`, tone: 'target' as const },
      ]
    : series.refs;

  const points = months.map((m, i) => ({ label: m.label, value: values[i] ?? 0, forecast: m.kind === 'forecast' }));

  return (
    <section className={`kpi-drawer ${relatedIds.includes(id) ? 'related' : ''}`} role="dialog" aria-label={`${kpi.label} details`} data-kpi={id}>
      <header>
        <div>
          <div className="eyebrow">{kpi.label}</div>
          <div className="big">
            <CountText value={kpi.value(state)} decimals={kpi.decimals} />
            <small>{kpi.unit}</small>
            <span className="sub">{kpi.sub(state)}</span>
          </div>
        </div>
        <div className="drawer-actions">
          <button
            type="button"
            className="chip"
            onClick={() => (focus.kind === 'asset' ? exploreStore.inspect(focus.id) : exploreStore.flyToPreset(focus.id))}
          >
            {focus.label}
          </button>
          <button type="button" className="explore-close" aria-label="Close" onClick={() => exploreStore.openKpi(null)}>
            ×
          </button>
        </div>
      </header>
      <div className="drawer-body">
        <div className="drawer-chart">
          <div className="drawer-title">{oilSeries ? 'June 2026 to April 2027' : 'June to December 2026'}</div>
          <LineChart
            points={points}
            domain={oilSeries ? [0, 140] : series.domain}
            refs={oilRefs}
            color={color}
            unit={kpi.unit}
            decimals={kpi.decimals}
            cursor={cursor}
            onHover={(i) => {
              exploreStore.touch();
              if (i != null) asOfStore.setIndex(i);
            }}
          />
          {oilSeries ? <OilTimeline compact /> : (
          <div className="scrubber">
            <input
              type="range"
              min={0}
              max={months.length - 1}
              step={0.01}
              value={Math.min(months.length - 1, cursor)}
              aria-label="Month"
              onChange={(e) => {
                asOfStore.setIndex(Number(e.target.value));
                exploreStore.touch();
              }}
            />
            <div className="scrub-read">
              <b>{monthLabel}</b> {valueAt(values, cursor).toFixed(kpi.decimals)} {kpi.unit}
              {asOf.index != null ? (
                <button type="button" className="link" onClick={() => asOfStore.live()}>
                  Live
                </button>
              ) : null}
            </div>
          </div>
          )}
        </div>
        <Side id={id} state={state} gold={gold} />
      </div>
    </section>
  );
}
