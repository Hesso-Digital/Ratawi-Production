/**
 * KPI detail drawer: opens from a KPI tile (or the hero number) in explore
 * mode. Trend chart June to December with commitment / target / limit lines,
 * a scrubber linked to the June to December replay, gauges and a breakdown,
 * and for wells the clickable well status chart. Live values come from the
 * same scene state as the HUD, so they animate with every /operator cue.
 */
import { useState } from 'react';
import { KPIS, type KpiId } from '../../../data/kpis';
import { KPI_SERIES, MONTHS, OIL_STEPS, TODAY_INDEX, valueAt } from '../../../data/series';
import { BUDGET_KBOPD, GAS_MIN_TO_OPERATE_MMSCFD, LIMITS, TARGET_KBOPD } from '../../../data/defaults';
import type { SceneState } from '../../../scene/ceremonyTimeline';
import { exploreStore } from '../../../scene/explore/exploreStore';
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
            { value: BUDGET_KBOPD, label: `${BUDGET_KBOPD}` },
            { value: TARGET_KBOPD, label: `${TARGET_KBOPD}`, gold: true },
          ]}
        />
        <div className="breakdown">
          {OIL_STEPS.map((s) => {
            const reached = state.oil >= s.value - 0.05;
            return (
              <div key={s.label} className={`bd-row ${reached ? 'on' : ''}`}>
                <span>{s.label}</span>
                <b>{s.value === OIL_STEPS[0].value ? s.value : `+${s.delta}`}</b>
              </div>
            );
          })}
        </div>
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
          <b>{state.oil.toFixed(1)} kbopd</b>
        </div>
        <div className="bd-row on">
          <span>Oil export, metered</span>
          <b>{state.exportKbopd.toFixed(1)} kbopd</b>
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
  const gold = state.gold > 0.5 && (id === 'oil' || id === 'wells');
  const color = toneColor(series.tone, gold);
  const [scrub, setScrub] = useState<number | null>(null);
  const playbackIndex = state.cueKind === 'playback' && state.playback ? state.playback.index : null;
  const cursor = scrub ?? playbackIndex ?? TODAY_INDEX;
  const following = scrub === null && playbackIndex !== null;
  const monthLabel = MONTHS[Math.round(cursor)]?.label ?? '';
  const focus = FOCUS[id];

  const points = MONTHS.map((m, i) => ({ label: m.label, value: series.values[i], forecast: m.kind === 'forecast' }));

  return (
    <section className={`kpi-drawer ${relatedIds.includes(id) ? 'related' : ''}`} role="dialog" aria-label={`${kpi.label} details`} data-kpi={id}>
      <header>
        <div>
          <div className="eyebrow">{kpi.label}</div>
          <div className="big">
            {kpi.value(state).toFixed(kpi.decimals)}
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
          <div className="drawer-title">June to December 2026</div>
          <LineChart
            points={points}
            domain={series.domain}
            refs={series.refs}
            color={color}
            unit={kpi.unit}
            decimals={kpi.decimals}
            cursor={cursor}
            onHover={() => exploreStore.touch()}
          />
          <div className="scrubber">
            <input
              type="range"
              min={0}
              max={MONTHS.length - 1}
              step={0.01}
              value={cursor}
              aria-label="Month"
              onChange={(e) => {
                setScrub(Number(e.target.value));
                exploreStore.touch();
              }}
            />
            <div className="scrub-read">
              <b>{monthLabel}</b> {valueAt(series.values, cursor).toFixed(kpi.decimals)} {kpi.unit}
              {following ? <em>following replay</em> : null}
              {scrub !== null ? (
                <button type="button" className="link" onClick={() => setScrub(null)}>
                  {playbackIndex !== null ? 'Follow replay' : 'Back to today'}
                </button>
              ) : null}
            </div>
          </div>
        </div>
        <Side id={id} state={state} gold={gold} />
      </div>
    </section>
  );
}
