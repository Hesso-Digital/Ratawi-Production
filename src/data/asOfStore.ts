/**
 * Viewer-facing "as of" date on the oil production timeline. Independent of the
 * hall's live Current / AGUP online state and of the admin ceremony replay.
 */
import { useSyncExternalStore } from 'react';
import { TRAJECTORY } from './defaults';

export const TIMELINE_DURATION_MS = 7000;
export const TIMELINE_LAST_INDEX = TRAJECTORY.length - 1;

type AsOfState = {
  /** Fractional month index along June 2026–April 2027, or null for Live. */
  index: number | null;
  playing: boolean;
};

type Listener = () => void;

let state: AsOfState = { index: null, playing: false };
const listeners = new Set<Listener>();
let raf = 0;
let playFrom = 0;
let playStartedAt = 0;
let playDuration = TIMELINE_DURATION_MS;

function emit() {
  for (const l of listeners) l();
}

function set(patch: Partial<AsOfState>) {
  state = { ...state, ...patch };
  emit();
}

function stopPlayLoop() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
}

function tick() {
  const elapsed = performance.now() - playStartedAt;
  const span = TIMELINE_LAST_INDEX - playFrom;
  const t = span <= 0 ? 1 : Math.min(1, elapsed / playDuration);
  const index = playFrom + span * t;
  if (t >= 1) {
    raf = 0;
    set({ index: TIMELINE_LAST_INDEX, playing: false });
    return;
  }
  set({ index, playing: true });
  raf = requestAnimationFrame(tick);
}

export const asOfStore = {
  get: () => state,
  subscribe(cb: Listener) {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
  setIndex(index: number) {
    stopPlayLoop();
    const i = Math.max(0, Math.min(TIMELINE_LAST_INDEX, index));
    set({ index: i, playing: false });
  },
  play() {
    const start = state.index == null ? 0 : Math.min(state.index, TIMELINE_LAST_INDEX);
    if (start >= TIMELINE_LAST_INDEX - 1e-4) {
      playFrom = 0;
    } else {
      playFrom = start;
    }
    playStartedAt = performance.now();
    playDuration = Math.max(
      200,
      ((TIMELINE_LAST_INDEX - playFrom) / TIMELINE_LAST_INDEX) * TIMELINE_DURATION_MS,
    );
    set({ index: playFrom, playing: true });
    stopPlayLoop();
    raf = requestAnimationFrame(tick);
  },
  pause() {
    stopPlayLoop();
    set({ playing: false, index: state.index });
  },
  live() {
    stopPlayLoop();
    set({ index: null, playing: false });
  },
};

export function useAsOfState(): AsOfState {
  return useSyncExternalStore(asOfStore.subscribe, asOfStore.get);
}
