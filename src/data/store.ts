import { useEffect, useState } from 'react';
import { CHANNEL_NAME, PLAYBACK_MS, STORAGE_KEY } from '../config';
import { defaultState, snapshotAtPlayback } from './defaults';
import type { AppState, CeremonyStep, ChannelMessage, Snapshot } from './types';

type Playback =
  | { playing: false }
  | { playing: true; startedAt: number; duration: number };

type ViewState = AppState & { playback: Playback; display: Snapshot };

function readStored(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as AppState;
    if (!parsed?.snapshot || typeof parsed.snapshot.oil !== 'number') {
      return defaultState();
    }
    return {
      snapshot: parsed.snapshot,
      step: (parsed.step === 1 || parsed.step === 2 ? parsed.step : 0) as CeremonyStep,
      origin: 'mock',
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
  const [tick, setTick] = useState(0);

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

  const display: Snapshot = playback.playing
    ? snapshotAtPlayback(progress)
    : core.snapshot;

  const setState = (next: AppState) => {
    setCore(next);
    publishState(next);
  };

  const applySnapshot = (snapshot: Snapshot, step: CeremonyStep = core.step) => {
    setPlayback({ playing: false });
    stopPlaybackBroadcast();
    setState({ ...core, snapshot, step });
  };

  const playStory = () => {
    const meta = startPlaybackBroadcast();
    setPlayback({ playing: true, ...meta });
  };

  const reset = () => {
    setPlayback({ playing: false });
    stopPlaybackBroadcast();
    setState(defaultState());
  };

  const view: ViewState = { ...core, playback, display };

  return {
    ...view,
    progress,
    playbackIndex: playback.playing ? progress * 6 : null,
    applySnapshot,
    playStory,
    stopStory: () => {
      setPlayback({ playing: false });
      stopPlaybackBroadcast();
    },
    reset,
    tick,
  };
}
