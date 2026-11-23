/**
 * Minimal 1-day fallback (plan rules): a 2D countdown plus the gold milestone
 * moment, with no WebGL dependency at all. Reachable at /fallback, or by
 * setting the operator's View to "Fallback". Kept deliberately simple — if
 * time runs out before the 3D build is rehearsed, this is what runs the room.
 */
import { useEffect, useRef, useState } from 'react';
import { HeaderBar } from '../components/HeaderBar';
import { HeroCard } from '../components/HeroCard';
import { KpiTiles } from '../components/KpiTiles';
import { CountdownRing } from '../components/reveal/CountdownRing';
import { sceneStateAt, type SceneState } from '../scene/ceremonyTimeline';
import { useCeremonyStore } from '../data/store';
import type { AppState } from '../data/types';

function useFallbackClock(cue: AppState['cue'], prevSnapshot: AppState['prevSnapshot'], snapshot: AppState['snapshot']) {
  const [state, setState] = useState<SceneState>(() =>
    sceneStateAt(cue, (Date.now() - cue.startedAt) / 1000, prevSnapshot, snapshot),
  );
  const raf = useRef(0);

  useEffect(() => {
    const loop = () => {
      setState(sceneStateAt(cue, (Date.now() - cue.startedAt) / 1000, prevSnapshot, snapshot));
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [cue, prevSnapshot, snapshot]);

  return state;
}

export function FallbackAudience() {
  const store = useCeremonyStore();
  const scene = useFallbackClock(store.cue, store.prevSnapshot, store.snapshot);

  return (
    <div className={`fallback-stage ${scene.gold > 0.5 ? 'gold' : ''}`}>
      <HeaderBar />
      <div className="fallback-body">
        <HeroCard oil={scene.oil} />
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
      <CountdownRing state={scene} />
    </div>
  );
}
