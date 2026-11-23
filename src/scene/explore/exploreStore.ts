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
import type { KpiId } from '../../data/kpis';
import type { CameraState } from '../ceremonyTimeline';

export type ExploreMode = 'show' | 'explore' | 'returning';

export type FlyRequest =
  | { kind: 'preset'; id: string; seq: number }
  | { kind: 'asset'; id: string; seq: number }
  /** A framing supplied directly, e.g. the exploded layers or production ribbon views. */
  | { kind: 'camera'; camera: CameraState; seq: number };

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
  /** Incremented to ask the rig to yaw the view so north is up, keeping target and distance. */
  northUpSeq: number;
  /** KPI whose detail drawer is open (explore mode only). */
  kpiId: KpiId | null;
  /** Focused area (keys 1–8). Null in show mode and before a viewpoint is chosen. */
  areaId: string | null;
};

type Listener = () => void;

let state: ExploreState = {
  mode: 'show',
  hoveredId: null,
  selectedId: null,
  fly: null,
  returnSeq: 0,
  exploreSeq: 0,
  northUpSeq: 0,
  kpiId: null,
  areaId: null,
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
    if (mode === 'show') {
      if (state.mode !== mode || state.areaId !== null) set({ mode, areaId: null });
      return;
    }
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
    set({ fly: { kind: 'preset', id, seq: ++seq }, areaId: id, selectedId: null, kpiId: null });
  },
  /** Fly to a camera framing that is not a named viewpoint. */
  flyToCamera(camera: CameraState) {
    set({ fly: { kind: 'camera', camera, seq: ++seq }, areaId: null, selectedId: null, kpiId: null });
  },
  /** Highlight an area without issuing a camera fly (used by the field tour). */
  focusArea(id: string | null) {
    if (state.areaId !== id) set({ areaId: id });
  },
  startExplore() {
    set({ exploreSeq: state.exploreSeq + 1 });
  },
  /** Yaw the live camera so north is up. Enters explore if the show is running. */
  orientNorthUp() {
    set({ northUpSeq: state.northUpSeq + 1 });
  },
  backToShow() {
    set({ selectedId: null, hoveredId: null, kpiId: null, areaId: null, returnSeq: state.returnSeq + 1 });
  },
  /** Open a KPI's detail drawer; this also starts free roam (panels only expand in explore). */
  openKpi(id: KpiId | null) {
    if (id === null) set({ kpiId: null });
    else set({ kpiId: id, exploreSeq: state.exploreSeq + 1 });
  },
  /** Any interaction with the panels counts as activity for the idle timer. */
  touch() {
    set({});
  },
  /** Test/reset hook: back to a clean show state. */
  reset() {
    set({ mode: 'show', hoveredId: null, selectedId: null, fly: null, kpiId: null, areaId: null, northUpSeq: 0 });
  },
};

export function useExploreState(): ExploreState {
  return useSyncExternalStore(exploreStore.subscribe, exploreStore.get);
}
