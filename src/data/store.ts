import { useEffect, useState } from 'react';
import { CHANNEL_NAME, PLAYBACK_MS, STORAGE_KEY } from '../config';
import { defaultState, PLAYBACK_END_INDEX, snapshotAtPlayback } from './defaults';
import type {
  AppState,
  CeremonyStep,
  ChannelMessage,
  Cue,
  CueKind,
  Quality,
  Snapshot,
  ViewMode,
} from './types';

type Playback =
  | { playing: false }
  | { playing: true; startedAt: number; duration: number };

type ViewState = AppState & { playback: Playback; display: Snapshot };

const VALID_CUE_KINDS: CueKind[] = ['idle', 'countdown', 'step1', 'step2', 'playback'];
const VALID_VIEWS: ViewMode[] = ['reveal', 'classic', 'fallback'];
const VALID_QUALITIES: Quality[] = ['low', 'medium', 'high'];

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
      origin: 'mock',
      cue,
      view: parsed.view && VALID_VIEWS.includes(parsed.view) ? parsed.view : fallback.view,
      quality: parsed.quality && VALID_QUALITIES.includes(parsed.quality) ? parsed.quality : fallback.quality,
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

export function startPlaybackBroadcast(duration = PLAYBACK_MS) {
  const startedAt = Date.now();
  ch?.postMessage({ type: 'playback-start', startedAt, duration } satisfies ChannelMessage);
  return { startedAt, duration };
}

export function stopPlaybackBroadcast() {
  ch?.postMessage({ type: 'playback-stop' } satisfies ChannelMessage);
}

export function useCeremonyStore() {
  const [core, setCore] = useState<AppState>(() => readStored());
  const [playback, setPlayback] = useState<Playback>({ playing: false });
  const [, setTick] = useState(0);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        const next = JSON.parse(e.newValue) as AppState;
        setCore(next);
      } catch {
        /* ignore */
      }
    };
    const onMessage = (e: MessageEvent<ChannelMessage>) => {
      const msg = e.data;
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'state') setCore(msg.state);
      if (msg.type === 'cue') setCore((c) => ({ ...c, cue: msg.cue }));
      if (msg.type === 'playback-start') {
        setPlayback({ playing: true, startedAt: msg.startedAt, duration: msg.duration });
      }
      if (msg.type === 'playback-stop') setPlayback({ playing: false });
    };
    window.addEventListener('storage', onStorage);
    ch?.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('storage', onStorage);
      ch?.removeEventListener('message', onMessage);
    };
  }, []);

  useEffect(() => {
    if (!playback.playing) return;
    let raf = 0;
    const loop = () => {
      const t = (Date.now() - playback.startedAt) / playback.duration;
      if (t >= 1) {
        setPlayback({ playing: false });
        setTick((n) => n + 1);
        return;
      }
      setTick((n) => n + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playback]);

  const progress = playback.playing
    ? Math.min(1, Math.max(0, (Date.now() - playback.startedAt) / playback.duration))
    : 0;

  const display: Snapshot = playback.playing ? snapshotAtPlayback(progress) : core.snapshot;

  const setState = (next: AppState) => {
    setCore(next);
    publishState(next);
  };

  /**
   * Apply a target snapshot. `cueKind` decides the ceremony behaviour:
   * - 'idle' (default): a manual edit or reset. No cinematic; the HUD count-up
   *   tweens directly to the new value (Apply values / Reset).
   * - 'step1' / 'step2': a ceremony beat. `prevSnapshot` is frozen at the
   *   current snapshot so the 3D scene and HUD lerp from it to the new target
   *   using the same eases on every display, live or manual.
   */
  const applySnapshot = (
    snapshot: Snapshot,
    step: CeremonyStep = core.step,
    cueKind: CueKind = 'idle',
  ) => {
    setPlayback({ playing: false });
    stopPlaybackBroadcast();
    const prevSnapshot = cueKind === 'idle' ? snapshot : core.snapshot;
    const cue: Cue = { kind: cueKind, startedAt: Date.now() };
    setState({ ...core, snapshot, prevSnapshot, step, cue });
  };

  /** Countdown "3, 2, 1" cue. Snapshot/step are untouched; only the clock moves. */
  const startCountdown = () => {
    setPlayback({ playing: false });
    stopPlaybackBroadcast();
    const cue: Cue = { kind: 'countdown', startedAt: Date.now() };
    setState({ ...core, cue });
  };

  /**
   * Jump the cue clock to a rehearsal offset without waiting in real time, by
   * back-dating `startedAt`. Used by the operator's "Jump to beat" control.
   */
  const jumpToCue = (kind: CueKind, offsetS: number) => {
    const cue: Cue = { kind, startedAt: Date.now() - Math.max(0, offsetS) * 1000 };
    setState({ ...core, cue });
  };

  const playStory = () => {
    const meta = startPlaybackBroadcast();
    setPlayback({ playing: true, ...meta });
    const cue: Cue = { kind: 'playback', startedAt: meta.startedAt };
    setState({ ...core, cue });
  };

  const stopStory = () => {
    setPlayback({ playing: false });
    stopPlaybackBroadcast();
    const cue: Cue = { kind: 'idle', startedAt: Date.now() };
    setState({ ...core, cue });
  };

  const reset = () => {
    setPlayback({ playing: false });
    stopPlaybackBroadcast();
    setState(defaultState());
  };

  const setView = (view: ViewMode) => setState({ ...core, view });
  const setQuality = (quality: Quality) => setState({ ...core, quality });

  const view: ViewState = { ...core, playback, display };

  return {
    ...view,
    progress,
    playbackIndex: playback.playing ? progress * PLAYBACK_END_INDEX : null,
    applySnapshot,
    startCountdown,
    jumpToCue,
    playStory,
    stopStory,
    reset,
    setView,
    setQuality,
  };
}
