/**
 * Free-roam ("explore") state for the hall screen, shared between the 3D rig,
 * the inspect targets and the HTML overlay. A tiny external store (no extra
 * dependency) read with useSyncExternalStore in React and directly in useFrame.
 *
 * Modes:
 *   show       the cinematic camera from ceremonyTimeline.ts drives the view
 *   explore    the viewer orbits, pans and zooms freely
 *   returning  a short GSAP-eased hand-back from wherever the viewer was to the show camera
 */
import { useSyncExternalStore } from 'react';

export type ExploreMode = 'show' | 'explore' | 'returning';

export type FlyRequest =
  | { kind: 'preset'; id: string; seq: number }
  | { kind: 'asset'; id: string; seq: number };

export type ExploreState = {
  mode: ExploreMode;
  hoveredId: string | null;
  selectedId: string | null;
  /** Set by the overlay / keys, consumed by the camera rig. */
  fly: FlyRequest | null;
  /** Incremented to ask the rig to hand the view back to the show camera. */
  returnSeq: number;
  /** Incremented to ask the rig to start free roam from the current view. */
  exploreSeq: number;
};

type Listener = () => void;

let state: ExploreState = {
  mode: 'show',
  hoveredId: null,
  selectedId: null,
  fly: null,
  returnSeq: 0,
  exploreSeq: 0,
};
const listeners = new Set<Listener>();
let seq = 0;

function set(patch: Partial<ExploreState>) {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

export const exploreStore = {
  get: () => state,
  subscribe(cb: Listener) {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
  setMode(mode: ExploreMode) {
    if (state.mode !== mode) set({ mode });
  },
  hover(id: string | null) {
    if (state.hoveredId !== id) set({ hoveredId: id });
  },
  select(id: string | null) {
    if (state.selectedId !== id) set({ selectedId: id });
  },
  /** Select an asset and fly the camera to frame it. */
  inspect(id: string) {
    set({ selectedId: id, fly: { kind: 'asset', id, seq: ++seq } });
  },
  flyToPreset(id: string) {
    set({ fly: { kind: 'preset', id, seq: ++seq } });
  },
  startExplore() {
    set({ exploreSeq: state.exploreSeq + 1 });
  },
  backToShow() {
    set({ selectedId: null, hoveredId: null, returnSeq: state.returnSeq + 1 });
  },
  /** Test/reset hook: back to a clean show state. */
  reset() {
    set({ mode: 'show', hoveredId: null, selectedId: null, fly: null });
  },
};

export function useExploreState(): ExploreState {
  return useSyncExternalStore(exploreStore.subscribe, exploreStore.get);
}
