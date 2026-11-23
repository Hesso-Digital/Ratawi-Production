/**
 * Drives one `SceneState` per animation frame from the store's cue, and shares
 * it with both the 3D scene and the HTML HUD so they always show the same
 * number (plan section 4.1). The 3D scene reads a mutable ref every frame
 * inside `useFrame` (zero React re-renders); the HUD subscribes through
 * `useSceneSnapshot`, throttled to ~12fps, which is smooth for text/number
 * displays and far cheaper than re-rendering HUD DOM at 60fps.
 */
import { createContext, useContext, useEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { sceneStateAt, type SceneState } from './ceremonyTimeline';
import type { Cue, Snapshot } from '../data/types';

const HUD_UPDATE_INTERVAL_MS = 80;

type Listener = () => void;

export type SceneClock = {
  /** Always current; read this inside useFrame / render loops, never in React render. */
  ref: { current: SceneState };
  subscribe: (cb: Listener) => () => void;
  getSnapshot: () => SceneState;
};

function makeInitialState(cue: Cue, prevSnapshot: Snapshot, snapshot: Snapshot): SceneState {
  return sceneStateAt(cue, (Date.now() - cue.startedAt) / 1000, prevSnapshot, snapshot);
}

function useCreateSceneClock(cue: Cue, prevSnapshot: Snapshot, snapshot: Snapshot): SceneClock {
  const ref = useRef<SceneState>(makeInitialState(cue, prevSnapshot, snapshot));
  const listeners = useRef(new Set<Listener>());
  const lastHudUpdate = useRef(0);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const elapsedS = (Date.now() - cue.startedAt) / 1000;
      ref.current = sceneStateAt(cue, elapsedS, prevSnapshot, snapshot);
      const now = performance.now();
      if (now - lastHudUpdate.current >= HUD_UPDATE_INTERVAL_MS) {
        lastHudUpdate.current = now;
        for (const cb of listeners.current) cb();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [cue, prevSnapshot, snapshot]);

  return useMemo(
    () => ({
      ref,
      subscribe: (cb: Listener) => {
        listeners.current.add(cb);
        return () => listeners.current.delete(cb);
      },
      getSnapshot: () => ref.current,
    }),
    // ref/listeners are stable for the component's lifetime
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
}

const SceneClockContext = createContext<SceneClock | null>(null);

export function SceneClockProvider({
  cue,
  prevSnapshot,
  snapshot,
  children,
}: {
  cue: Cue;
  prevSnapshot: Snapshot;
  snapshot: Snapshot;
  children: ReactNode;
}) {
  const clock = useCreateSceneClock(cue, prevSnapshot, snapshot);
  return <SceneClockContext.Provider value={clock}>{children}</SceneClockContext.Provider>;
}

function useSceneClockContext(): SceneClock {
  const ctx = useContext(SceneClockContext);
  if (!ctx) throw new Error('useSceneClock hooks must be used inside <SceneClockProvider>');
  return ctx;
}

/** For useFrame / imperative 3D code: a ref that is always current, no re-render. */
export function useSceneClockRef() {
  return useSceneClockContext().ref;
}

/** For HUD components: a throttled, React-friendly snapshot of the scene state. */
export function useSceneSnapshot(): SceneState {
  const { subscribe, getSnapshot } = useSceneClockContext();
  return useSyncExternalStore(subscribe, getSnapshot);
}
