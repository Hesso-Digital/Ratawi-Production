import { FORECAST_END_INDEX, TRAJECTORY } from '../../data/defaults';
import { KPIS } from '../../data/kpis';
import { isAgupOnline } from '../../data/presets';
import { snapshotAtMonth } from '../../data/series';
import { useCeremonyStore } from '../../data/store';
import type { SceneState } from '../../scene/ceremonyTimeline';
import { relatedKpis } from '../../scene/explore/assets';
import { exploreStore, useExploreState } from '../../scene/explore/exploreStore';
import { CountText } from '../CountText';

export function KpiRail({ state, interactive = false }: { state: SceneState; interactive?: boolean }) {
  const { selectedId, kpiId } = useExploreState();
  const related = interactive ? relatedKpis(selectedId) : [];
  const store = useCeremonyStore();
  const online = isAgupOnline(store.snapshot, store.presets) || state.step >= 2;
  const forecast = snapshotAtMonth(FORECAST_END_INDEX, store.presets, online);
  const end = TRAJECTORY[FORECAST_END_INDEX];
  return (
    <div className="reveal-rail">
      {KPIS.map((kpi) => {
        const value = kpi.value(state);
        const tone = kpi.tone?.(state) ?? 'default';
        const alert = kpi.alert?.(state);
        const barPct = kpi.id === 'oil' ? 60 : 40;
        const toneClass = tone === 'gold' ? 'hot' : tone === 'gas' ? 'gas' : '';
        return (
          <div
            key={kpi.id}
            className={`reveal-kpi ${toneClass} ${alert ? 'alert' : ''} ${interactive ? 'clickable' : ''} ${related.includes(kpi.id) ? 'related' : ''} ${kpiId === kpi.id ? 'open' : ''}`}
            data-kpi={kpi.id}
            {...(interactive
              ? {
                  role: 'button',
                  tabIndex: 0,
                  'aria-label': `${kpi.label} trend`,
                  onClick: () => exploreStore.openKpi(kpiId === kpi.id ? null : kpi.id),
                  onKeyDown: (e: React.KeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') exploreStore.openKpi(kpi.id);
                  },
                }
              : {})}
          >
            <div className="bar" style={{ width: `${barPct}%` }} />
            <div className="k">{kpi.label}</div>
            <div className="v">
              <CountText value={value} decimals={kpi.decimals} />
              <small>{kpi.unit}</small>
            </div>
            <div className="s">
              <i />
              {kpi.sub(state)}
            </div>
            {interactive ? (
              <div className="kpi-tip">
                June 2026 to {end.label} {end.year} · click to open
                <span className="kpi-forecast">
                  Forecast {end.label} {end.year}: {kpi.value({ ...state, ...forecast }).toFixed(kpi.decimals)} {kpi.unit}
                </span>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
