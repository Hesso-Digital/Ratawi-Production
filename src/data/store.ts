import { useEffect, useState } from 'react';
import { CHANNEL_NAME, STORAGE_KEY } from '../config';
import { BASELINE, defaultState, STEP_1, STEP_2 } from './defaults';
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
      origin: 'manual',
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

export function useCeremonyStore() {
  const [core, setCore] = useState<AppState>(() => readStored());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        setCore(JSON.parse(e.newValue) as AppState);
      } catch {
        /* ignore */
      }
    };
    const onMessage = (e: MessageEvent<ChannelMessage>) => {
      const msg = e.data;
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'state') setCore(msg.state);
      if (msg.type === 'cue') setCore((c) => ({ ...c, cue: msg.cue }));
    };
    window.addEventListener('storage', onStorage);
    ch?.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('storage', onStorage);
      ch?.removeEventListener('message', onMessage);
    };
  }, []);

  const setState = (next: AppState) => {
    setCore(next);
    publishState(next);
  };

  /**
   * Start a choreographed beat. `from` is what the beat animates away from and
   * `to` is where it lands; both default to the current snapshot. The audience
   * derives everything from (cue, from, to), so a refresh resumes mid-beat.
   */
  const startCue = (
    kind: CueKind,
    opts: { from?: Snapshot; to?: Snapshot; step?: CeremonyStep; startedAt?: number } = {},
  ) => {
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
  const applySnapshot = (snapshot: Snapshot, step: CeremonyStep = core.step) =>
    startCue('idle', { from: snapshot, to: snapshot, step });

  /** Step 1: valves open, flow to CPF-1, 105 to 110 kbopd. */
  const runStep1 = () => startCue('step1', { from: BASELINE, to: STEP_1, step: 1 });

  /** Countdown 3, 2, 1, which runs on into Step 2 by itself. */
  const runCountdown = () => startCue('countdown', { from: STEP_1, to: STEP_2, step: 2 });

  /** Step 2 without the countdown (rehearsal, or if the operator skips it). */
  const runStep2 = () => startCue('step2', { from: STEP_1, to: STEP_2, step: 2 });

  /** Replay of June to December. Leaves the snapshot untouched. */
  const playStory = () => startCue('playback', { from: core.snapshot, to: core.snapshot });

  const stopStory = () => startCue('idle', { from: core.snapshot, to: core.snapshot });

  /**
   * Rehearsal jump: start the given beat as if it began `offsetS` seconds ago,
   * with the values that beat expects, so it works from any state.
   */
  const jumpToCue = (kind: CueKind, offsetS: number) => {
    const startedAt = Date.now() - Math.max(0, offsetS) * 1000;
    if (kind === 'step1') startCue('step1', { from: BASELINE, to: STEP_1, step: 1, startedAt });
    else if (kind === 'countdown' || kind === 'step2') startCue(kind, { from: STEP_1, to: STEP_2, step: 2, startedAt });
    else if (kind === 'playback') startCue('playback', { from: STEP_2, to: STEP_2, step: 2, startedAt });
    else startCue('idle', { from: BASELINE, to: BASELINE, step: 0, startedAt });
  };

  /** Back to the establishing shot. View and quality are kept. */
  const reset = () => setState({ ...defaultState(), view: core.view, quality: core.quality });

  const setView = (view: ViewMode) => setState({ ...core, view });
  const setQuality = (quality: Quality) => setState({ ...core, quality });

  return {
    ...core,
    startCue,
    applySnapshot,
    runStep1,
    runCountdown,
    runStep2,
    jumpToCue,
    playStory,
    stopStory,
    reset,
    setView,
    setQuality,
  };
}
