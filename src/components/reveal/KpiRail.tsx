import { KPIS } from '../../data/kpis';
import type { SceneState } from '../../scene/ceremonyTimeline';

export function KpiRail({ state }: { state: SceneState }) {
  return (
    <div className="reveal-rail">
      {KPIS.map((kpi) => {
        const value = kpi.value(state);
        const tone = kpi.tone?.(state) ?? 'default';
        const alert = kpi.alert?.(state);
        const barPct = kpi.id === 'oil' ? 60 : 40;
        const toneClass = tone === 'gold' ? 'hot' : tone === 'gas' ? 'gas' : '';
        return (
          <div key={kpi.id} className={`reveal-kpi ${toneClass} ${alert ? 'alert' : ''}`}>
            <div className="bar" style={{ width: `${barPct}%` }} />
            <div className="k">{kpi.label}</div>
            <div className="v">
              {value.toFixed(kpi.decimals)}
              <small>{kpi.unit}</small>
            </div>
            <div className="s">
              <i />
              {kpi.sub(state)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
