/**
 * Viewer scene settings: Day / Night and Flows on / off.
 *
 * Tiny external store (no React context needed), persisted in localStorage
 * and mirrored across tabs/windows (audience screen + /operator) with its own
 * BroadcastChannel. The corner menu can call the same API:
 *
 *   const { mode, setMode, toggle } = useTimeOfDay();
 *   const { flows, setFlows, toggleFlows } = useFlows();
 *   const { hudDimmed, setHudDimmed } = useHudFocus();
 *
 * The scene reads `dayBlend.value` (0 = night, 1 = day) every frame. It is
 * crossfaded with GSAP over ~1 s whenever the mode changes.
 */
import { useSyncExternalStore } from 'react';
import gsap from 'gsap';

export type TimeOfDay = 'night' | 'day';
export type SceneSettings = { mode: TimeOfDay; flows: boolean };

const STORAGE_KEY = 'ratawi.sceneSettings.v1';
const CHANNEL_NAME = 'ratawi-scene-settings';
const DEFAULTS: SceneSettings = { mode: 'night', flows: true };

function read(): SceneSettings {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<SceneSettings>;
    return {
      mode: parsed.mode === 'day' ? 'day' : 'night',
      flows: parsed.flows === false ? false : true,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function fromUrl(base: SceneSettings): SceneSettings {
  if (typeof window === 'undefined') return base;
  const p = new URLSearchParams(window.location.search);
  const tod = p.get('tod');
  const flows = p.get('flows');
  return {
    mode: tod === 'day' || tod === 'night' ? tod : base.mode,
    flows: flows === '0' || flows === 'off' ? false : flows === '1' || flows === 'on' ? true : base.flows,
  };
}

let state: SceneSettings = fromUrl(read());
const listeners = new Set<() => void>();

/**
 * Ephemeral HUD dim for cinematic focus (tour, exploded view, camera motion,
 * idle). Not persisted and not mirrored across tabs, so a refresh always
 * restores the full HUD. `setHudDimmed` stays the simple on/off used by the
 * field tour; other features should prefer requestHudDim / releaseHudDim.
 */
export type HudDimReason = 'tour' | 'exploded' | 'motion' | 'idle';
const hudReasons = new Set<HudDimReason>();
let hudHold = false;

function hudDimmedEffective() {
  return hudReasons.size > 0 && !hudHold;
}

/** Mutable crossfade value read by the scene in useFrame (0 night, 1 day). */
export const dayBlend = { value: state.mode === 'day' ? 1 : 0 };

let channel: BroadcastChannel | null = null;
function getChannel() {
  if (channel || typeof BroadcastChannel === 'undefined') return channel;
  channel = new BroadcastChannel(CHANNEL_NAME);
  channel.onmessage = (e: MessageEvent<SceneSettings>) => {
    if (e.data && (e.data.mode === 'day' || e.data.mode === 'night')) apply(e.data, false);
  };
  return channel;
}

function syncDom() {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.timeOfDay = state.mode;
  document.documentElement.dataset.flows = state.flows ? 'on' : 'off';
  document.documentElement.dataset.hudDimmed = hudDimmedEffective() ? 'on' : 'off';
}

function apply(next: SceneSettings, broadcast: boolean) {
  const prev = state;
  if (prev.mode === next.mode && prev.flows === next.flows) return;
  state = { ...next };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* private mode: keep in memory */
  }
  if (prev.mode !== state.mode) {
    gsap.killTweensOf(dayBlend);
    gsap.to(dayBlend, { value: state.mode === 'day' ? 1 : 0, duration: 1, ease: 'power2.inOut' });
  }
  syncDom();
  if (broadcast) getChannel()?.postMessage(state);
  listeners.forEach((l) => l());
}

export const sceneSettings = {
  get: () => state,
  subscribe(l: () => void) {
    listeners.add(l);
    getChannel();
    syncDom();
    return () => listeners.delete(l);
  },
  setMode: (mode: TimeOfDay) => apply({ ...state, mode }, true),
  toggle: () => apply({ ...state, mode: state.mode === 'day' ? 'night' : 'day' }, true),
  setFlows: (flows: boolean) => apply({ ...state, flows }, true),
  toggleFlows: () => apply({ ...state, flows: !state.flows }, true),
  getHudDimmed: () => hudDimmedEffective(),
  setHudDimmed(next: boolean) {
    // Field tour uses this as a simple lock. Map it to the 'tour' reason so
    // idle / motion / exploded can stack without clobbering each other.
    if (next) hudReasons.add('tour');
    else hudReasons.delete('tour');
    syncDom();
    listeners.forEach((l) => l());
  },
  requestHudDim(reason: HudDimReason) {
    if (hudReasons.has(reason)) return;
    hudReasons.add(reason);
    syncDom();
    listeners.forEach((l) => l());
  },
  releaseHudDim(reason: HudDimReason) {
    if (!hudReasons.has(reason)) return;
    hudReasons.delete(reason);
    syncDom();
    listeners.forEach((l) => l());
  },
  holdHud() {
    if (hudHold) return;
    hudHold = true;
    syncDom();
    listeners.forEach((l) => l());
  },
  releaseHold() {
    if (!hudHold) return;
    hudHold = false;
    syncDom();
    listeners.forEach((l) => l());
  },
};

function useSettings() {
  return useSyncExternalStore(sceneSettings.subscribe, sceneSettings.get, sceneSettings.get);
}

export function useTimeOfDay() {
  const { mode } = useSettings();
  return { mode, setMode: sceneSettings.setMode, toggle: sceneSettings.toggle };
}

export function useFlows() {
  const { flows } = useSettings();
  return { flows, setFlows: sceneSettings.setFlows, toggleFlows: sceneSettings.toggleFlows };
}

export function useHudFocus() {
  const hudDimmed = useSyncExternalStore(sceneSettings.subscribe, sceneSettings.getHudDimmed, () => false);
  return {
    hudDimmed,
    setHudDimmed: sceneSettings.setHudDimmed,
    requestHudDim: sceneSettings.requestHudDim,
    releaseHudDim: sceneSettings.releaseHudDim,
    holdHud: sceneSettings.holdHud,
    releaseHold: sceneSettings.releaseHold,
  };
}
