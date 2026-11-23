import { useMemo, useSyncExternalStore } from 'react';
import { CHANNEL_NAME, PLAYBACK_MS, STORAGE_KEY } from '../config';
import { BASELINE, DEFAULT_PRESETS, DEFAULT_SETTINGS, STEP_1, STEP_2, clonePresets, cloneSettings, defaultState } from './defaults';
import { isAgupOnline, linesFromPresets, parsePresets, presetsAreValid, validatePresets } from './presets';
import type {
  AppState,
  CeremonyStep,
  ChannelMessage,
  Cue,
  CueKind,
  DataPresets,
  DisplaySettings,
  Quality,
  Snapshot,
  ViewMode,
} from './types';

const VALID_CUE_KINDS: CueKind[] = ['idle', 'countdown', 'step1', 'step2', 'playback', 'live'];
const VALID_VIEWS: ViewMode[] = ['reveal', 'classic', 'fallback'];
const VALID_QUALITIES: Quality[] = ['low', 'medium', 'high'];


function parseSettings(v: unknown, fallback: DisplaySettings = DEFAULT_SETTINGS): DisplaySettings {
  if (!v || typeof v !== 'object') return cloneSettings(fallback);
  const raw = v as Partial<DisplaySettings>;
  return {
    reducedMotion: typeof raw.reducedMotion === 'boolean' ? raw.reducedMotion : fallback.reducedMotion,
    showAreaMarkers: typeof raw.showAreaMarkers === 'boolean' ? raw.showAreaMarkers : fallback.showAreaMarkers,
    showDateTime: typeof raw.showDateTime === 'boolean' ? raw.showDateTime : fallback.showDateTime,
  };
}

function isSnapshot(v: unknown): v is Snapshot {
  return !!v && typeof v === 'object' && typeof (v as Snapshot).oil === 'number';
}

function readStored(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    if (!isSnapshot(parsed?.snapshot)) return defaultState();
    const fallback = defaultState();
    const cue: Cue =
      parsed.cue && VALID_CUE_KINDS.includes(parsed.cue.kind) && typeof parsed.cue.startedAt === 'number'
        ? parsed.cue
        : fallback.cue;
    return {
      snapshot: parsed.snapshot,
      prevSnapshot: isSnapshot(parsed.prevSnapshot) ? parsed.prevSnapshot : parsed.snapshot,
      step: (parsed.step === 1 || parsed.step === 2 ? parsed.step : 0) as CeremonyStep,
      origin: 'manual',
      cue,
      view: parsed.view && VALID_VIEWS.includes(parsed.view) ? parsed.view : fallback.view,
      quality: parsed.quality && VALID_QUALITIES.includes(parsed.quality) ? parsed.quality : fallback.quality,
      presets: parsePresets(parsed.presets, fallback.presets),
      settings: parseSettings(parsed.settings, fallback.settings),
    };
  } catch {
    return defaultState();
  }
}

function persist(state: AppState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota */
  }
}

function channel() {
  try {
    return new BroadcastChannel(CHANNEL_NAME);
  } catch {
    return null;
  }
}

const ch = channel();

export function publishState(state: AppState) {
  persist(state);
  ch?.postMessage({ type: 'state', state } satisfies ChannelMessage);
}

/**
 * One shared store for every hook in this tab. Each `useCeremonyStore()` used
 * to keep its own `useState`, so the corner admin menu could bring AGUP
 * online without the hall HUD or 3D scene ever seeing the cue. BroadcastChannel
 * only notifies *other* tabs, so same-tab updates never crossed.
 */
let current: AppState = typeof window === 'undefined' ? defaultState() : readStored();
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getState(): AppState {
  return current;
}

/** Re-read localStorage. Tests call this after seeding or clearing storage. */
export function hydrateCeremonyStore() {
  current = typeof window === 'undefined' ? defaultState() : readStored();
  notify();
}

function setState(next: AppState) {
  current = next;
  publishState(next);
  notify();
}

function applyIncoming(state: AppState) {
  current = {
    ...state,
    presets: parsePresets(state.presets, DEFAULT_PRESETS),
    settings: parseSettings(state.settings, DEFAULT_SETTINGS),
  };
  notify();
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY || !e.newValue) return;
    try {
      applyIncoming(JSON.parse(e.newValue) as AppState);
    } catch {
      /* ignore */
    }
  });
  ch?.addEventListener('message', (e: MessageEvent<ChannelMessage>) => {
    const msg = e.data;
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'state') applyIncoming(msg.state);
    if (msg.type === 'cue') {
      current = { ...current, cue: msg.cue };
      notify();
    }
  });
}

const startCue = (
  kind: CueKind,
  opts: { from?: Snapshot; to?: Snapshot; step?: CeremonyStep; startedAt?: number } = {},
) => {
  const core = current;
  const to = opts.to ?? core.snapshot;
  const from = opts.from ?? core.snapshot;
  setState({
    ...core,
    prevSnapshot: from,
    snapshot: to,
    step: opts.step ?? core.step,
    cue: { kind, startedAt: opts.startedAt ?? Date.now() },
  });
};

/** A manual edit or reset: values jump to the target, no cinematic. */
const applySnapshot = (snapshot: Snapshot, step?: CeremonyStep) =>
  startCue('idle', { from: snapshot, to: snapshot, step: step ?? current.step });

/** Step 1: valves open, flow to CPF-1, 105 to 110 kbopd. */
const runStep1 = () => startCue('step1', { from: BASELINE, to: STEP_1, step: 1 });

/** Countdown 3, 2, 1, which runs on into Step 2 by itself. */
const runCountdown = () => startCue('countdown', { from: STEP_1, to: STEP_2, step: 2 });

/** Step 2 without the countdown (rehearsal, or if the operator skips it). */
const runStep2 = () => startCue('step2', { from: STEP_1, to: STEP_2, step: 2 });

/** Hall switch: Current values climb to the AGUP online snapshot, wells connect in sequence. */
const bringAgupOnline = () =>
  startCue('step2', { from: current.presets.current, to: current.presets.agup, step: 2 });

/** Hall switch: ease back to the Current values. */
const resetToCurrent = () =>
  startCue('live', { from: current.snapshot, to: current.presets.current, step: 0 });

const savePresets = (presets: DataPresets): boolean => {
  if (!presetsAreValid(validatePresets(presets))) return false;
  const core = current;
  const next = clonePresets(presets);
  const online = isAgupOnline(core.snapshot, core.presets) || core.cue.kind === 'step2' || core.step >= 2;
  const snapshot = online ? { ...next.agup } : { ...next.current };
  const midCue = core.cue.kind === 'step2' || core.cue.kind === 'live' || core.cue.kind === 'playback';
  setState({
    ...core,
    presets: next,
    snapshot,
    prevSnapshot: midCue ? core.prevSnapshot : snapshot,
    step: online ? 2 : 0,
    cue: midCue ? core.cue : { kind: 'idle', startedAt: Date.now() },
  });
  return true;
};

const resetPresets = () => savePresets(clonePresets(DEFAULT_PRESETS));

/** Replay of June to December. Leaves the stored snapshot untouched. */
const playStory = () =>
  startCue('playback', { from: current.presets.agup, to: current.presets.agup, step: 2 });

const stopStory = () => startCue('idle', { from: current.snapshot, to: current.snapshot });

const scrubPlayback = (progress: number) => {
  const p = Math.min(1, Math.max(0, progress));
  startCue('playback', {
    from: current.presets.agup,
    to: current.presets.agup,
    step: 2,
    startedAt: Date.now() - p * PLAYBACK_MS,
  });
};

/**
 * Rehearsal jump: start the given beat as if it began `offsetS` seconds ago,
 * with the values that beat expects, so it works from any state.
 */
const jumpToCue = (kind: CueKind, offsetS: number) => {
  const core = current;
  const startedAt = Date.now() - Math.max(0, offsetS) * 1000;
  if (kind === 'step1') startCue('step1', { from: BASELINE, to: STEP_1, step: 1, startedAt });
  else if (kind === 'countdown' || kind === 'step2') startCue(kind, { from: STEP_1, to: STEP_2, step: 2, startedAt });
  else if (kind === 'playback') startCue('playback', { from: core.presets.agup, to: core.presets.agup, step: 2, startedAt });
  else if (kind === 'live') startCue('live', { from: core.snapshot, to: core.presets.current, step: 0, startedAt });
  else startCue('idle', { from: core.presets.current, to: core.presets.current, step: 0, startedAt });
};

/** Back to the Current values. View and quality are kept. */
const reset = () =>
  setState({
    ...defaultState(),
    view: current.view,
    quality: current.quality,
    presets: clonePresets(current.presets),
    settings: cloneSettings(current.settings),
    snapshot: { ...current.presets.current },
    prevSnapshot: { ...current.presets.current },
  });

const setView = (view: ViewMode) => setState({ ...current, view });
const setQuality = (quality: Quality) => setState({ ...current, quality });
const setSettings = (patch: Partial<DisplaySettings>) =>
  setState({ ...current, settings: { ...current.settings, ...patch } });

export function useCeremonyStore() {
  const core = useSyncExternalStore(subscribe, getState, getState);
  const lines = useMemo(() => linesFromPresets(core.presets), [core.presets]);

  return {
    ...core,
    lines,
    startCue,
    applySnapshot,
    runStep1,
    runCountdown,
    runStep2,
    bringAgupOnline,
    resetToCurrent,
    savePresets,
    resetPresets,
    jumpToCue,
    playStory,
    stopStory,
    scrubPlayback,
    reset,
    setView,
    setQuality,
    setSettings,
  };
}
