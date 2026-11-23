/**
 * Minimal 2D hall view with no WebGL: hero, KPI tiles and the gold look.
 * Reachable at /fallback, or by setting the operator's View to "Fallback".
 */
import { HeaderBar } from '../components/HeaderBar';
import { HeroCard } from '../components/HeroCard';
import { KpiTiles } from '../components/KpiTiles';
import { useLiveScene } from '../scene/useLiveScene';
import { useCeremonyStore } from '../data/store';
import { useDisplayedKpis } from '../hooks/useDisplayedKpis';
import { OilTimeline } from '../components/reveal/OilTimeline';

export function FallbackAudience() {
  const store = useCeremonyStore();
  const live = useLiveScene(store.cue, store.prevSnapshot, store.snapshot, 50, store.lines);
  const scene = useDisplayedKpis(live);

  return (
    <div className={`fallback-stage ${scene.gold > 0.5 ? 'gold' : ''}`}>
      <HeaderBar />
      <div className="fallback-body">
        <div>
          <HeroCard oil={scene.oil} />
          <OilTimeline compact />
        </div>
        <KpiTiles
          data={{
            oil: scene.oil,
            wells: scene.wells,
            exportKbopd: scene.exportKbopd,
            gas: scene.gas,
            bsw: scene.bsw,
            salt: scene.salt,
            efficiency: scene.efficiency,
          }}
        />
      </div>
    </div>
  );
}
