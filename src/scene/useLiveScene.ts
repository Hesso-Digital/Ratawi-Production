import { useEffect, useState } from 'react';
import { elapsedFor, sceneStateAt, type SceneState } from './ceremonyTimeline';
import type { Cue, Snapshot } from '../data/types';

/**
 * The scenario clock for 2D views (classic grid, fallback): the same
 * `sceneStateAt` the 3D scene reads, sampled at about 20 fps so numbers, tiles
 * and the trajectory cursor move in step with the storyline.
 */
export function useLiveScene(cue: Cue, prevSnapshot: Snapshot, snapshot: Snapshot, intervalMs = 50): SceneState {
  const [state, setState] = useState<SceneState>(() => sceneStateAt(cue, elapsedFor(cue), prevSnapshot, snapshot));

  useEffect(() => {
    const tick = () => setState(sceneStateAt(cue, elapsedFor(cue), prevSnapshot, snapshot));
    tick();
    const id = window.setInterval(tick, intervalMs);
    return () => window.clearInterval(id);
  }, [cue, prevSnapshot, snapshot, intervalMs]);

  return state;
}
