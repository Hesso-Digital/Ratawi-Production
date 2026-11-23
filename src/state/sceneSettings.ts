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
 *   const { viewMode, toggleViewMode } = useViewMode();   // 'field' | 'exploded' | 'ribbon'
 *
 * The scene reads `dayBlend.value` (0 = night, 1 = day) every frame. It is
 * crossfaded with GSAP over ~1 s whenever the mode changes.
 */
import { useSyncExternalStore } from 'react';
import gsap from 'gsap';

export type TimeOfDay = 'night' | 'day';
/** Showpiece views: the normal field, the exploded glass layers, or the 3D production ribbon. */
export type ViewMode = 'field' | 'exploded' | 'ribbon';
export type SceneSettings = { mode: TimeOfDay; flows: boolean; viewMode: ViewMode };

function asViewMode(v: unknown): ViewMode {
  return v === 'exploded' || v === 'ribbon' ? v : 'field';
}

const STORAGE_KEY = 'ratawi.sceneSettings.v1';
const CHANNEL_NAME = 'ratawi-scene-settings';
const DEFAULTS: SceneSettings = { mode: 'night', flows: true, viewMode: 'field' };

function read(): SceneSettings {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<SceneSettings>;
    return {
      mode: parsed.mode === 'day' ? 'day' : 'night',
      flows: parsed.flows === false ? false : true,
      // The view mode is a live presentation choice; a reload starts on the field.
      viewMode: 'field',
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
    viewMode: p.has('view') ? asViewMode(p.get('view')) : base.viewMode,
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
export type HudDimReason = 'tour' | 'exploded' | 'ribbon' | 'motion' | 'idle';
const hudReasons = new Set<HudDimReason>();
let hudHold = false;

function hudDimmedEffective() {
  return hudReasons.size > 0 && !hudHold;
}

/** Mutable crossfade value read by the scene in useFrame (0 night, 1 day). */
export const dayBlend = { value: state.mode === 'day' ? 1 : 0 };

/** Mutable 0→1 blends for the showpiece views, tweened with GSAP (~1.5 s) and read in useFrame. */
export const explodeBlend = { value: state.viewMode === 'exploded' ? 1 : 0 };
export const ribbonBlend = { value: state.viewMode === 'ribbon' ? 1 : 0 };
export const VIEW_TRANSITION_S = 1.5;
if (state.viewMode !== 'field') hudReasons.add(state.viewMode);

let channel: BroadcastChannel | null = null;
function getChannel() {
  if (channel || typeof BroadcastChannel === 'undefined') return channel;
  channel = new BroadcastChannel(CHANNEL_NAME);
  channel.onmessage = (e: MessageEvent<SceneSettings>) => {
    if (e.data && (e.data.mode === 'day' || e.data.mode === 'night')) {
      apply({ ...e.data, viewMode: asViewMode(e.data.viewMode) }, false);
    }
  };
  return channel;
}

function syncDom() {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.timeOfDay = state.mode;
  document.documentElement.dataset.flows = state.flows ? 'on' : 'off';
  document.documentElement.dataset.viewMode = state.viewMode;
  document.documentElement.dataset.hudDimmed = hudDimmedEffective() ? 'on' : 'off';
}

function apply(next: SceneSettings, broadcast: boolean) {
  const prev = state;
  if (prev.mode === next.mode && prev.flows === next.flows && prev.viewMode === next.viewMode) return;
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
  if (prev.viewMode !== state.viewMode) {
    gsap.killTweensOf(explodeBlend);
    gsap.killTweensOf(ribbonBlend);
    const ease = 'power3.inOut';
    gsap.to(explodeBlend, { value: state.viewMode === 'exploded' ? 1 : 0, duration: VIEW_TRANSITION_S, ease });
    gsap.to(ribbonBlend, { value: state.viewMode === 'ribbon' ? 1 : 0, duration: VIEW_TRANSITION_S, ease });
    // The HUD steps back while a showpiece view is up.
    if (prev.viewMode !== 'field') sceneSettings.releaseHudDim(prev.viewMode);
    if (state.viewMode !== 'field') sceneSettings.requestHudDim(state.viewMode);
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
  setViewMode: (viewMode: ViewMode) => apply({ ...state, viewMode }, true),
  /** Press the same view again to go back to the field. */
  toggleViewMode: (viewMode: Exclude<ViewMode, 'field'>) =>
    apply({ ...state, viewMode: state.viewMode === viewMode ? 'field' : viewMode }, true),
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

export function useViewMode() {
  const { viewMode } = useSettings();
  return { viewMode, setViewMode: sceneSettings.setViewMode, toggleViewMode: sceneSettings.toggleViewMode };
}
