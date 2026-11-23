/**
 * Cinematic field tour: a Play control beside Day/Night starts a guided
 * camera flight around the hall field. The viewer can cut it short at any
 * time by touching the map or the 3D model; the camera stays where it is.
 *
 * Camera distance and FOV are scaled from the live canvas aspect so each
 * section stays in frame from mobile portrait through hall ultra-wide
 * screens (portrait pulls back).
 */
import { useSyncExternalStore } from 'react';
import type { CameraState } from '../ceremonyTimeline';

export type FieldTourState = {
  playing: boolean;
  caption: string | null;
  startSeq: number;
  stopSeq: number;
};

const DEFAULTS: FieldTourState = { playing: false, caption: null, startSeq: 0, stopSeq: 0 };

let state: FieldTourState = { ...DEFAULTS };
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export const fieldTour = {
  get: () => state,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
  start() {
    if (state.playing) return;
    state = { playing: true, caption: 'Whole field', startSeq: state.startSeq + 1, stopSeq: state.stopSeq };
    emit();
  },
  stop() {
    if (!state.playing) return;
    state = { playing: false, caption: null, startSeq: state.startSeq, stopSeq: state.stopSeq + 1 };
    emit();
  },
  toggle() {
    if (state.playing) fieldTour.stop();
    else fieldTour.start();
  },
  setCaption(caption: string | null) {
    if (!state.playing && caption === null) return;
    if (state.caption === caption) return;
    state = { ...state, caption };
    emit();
  },
  /** Test hook: back to a clean idle state without bumping stopSeq unless it was playing. */
  reset() {
    if (state.playing) {
      fieldTour.stop();
    }
    state = { ...DEFAULTS, startSeq: state.startSeq, stopSeq: state.stopSeq };
    emit();
  },
};

export function useFieldTour() {
  const s = useSyncExternalStore(fieldTour.subscribe, fieldTour.get, fieldTour.get);
  return { ...s, start: fieldTour.start, stop: fieldTour.stop, toggle: fieldTour.toggle };
}

/** Designed framing is 16:9; narrower viewports pull the camera back. */
export const REF_ASPECT = 16 / 9;

export type TourFraming = { distanceScale: number; fovDelta: number };

/**
 * Scale camera distance and FOV so a shot framed for 16:9 still fits.
 * Portrait and other narrow aspects pull back (and widen FOV slightly).
 * Ultra-wide hall screens keep vertical coverage and ease off only a little.
 */
export function framingForAspect(aspect: number): TourFraming {
  const a = Math.min(3.2, Math.max(aspect, 0.4));
  if (a < REF_ASPECT) {
    const raw = REF_ASPECT / a;
    return {
      distanceScale: Math.min(2.05, 1 + (raw - 1) * 0.7),
      fovDelta: Math.min(8, (raw - 1) * 4),
    };
  }
  const extra = (a - REF_ASPECT) / REF_ASPECT;
  return { distanceScale: 1 + Math.min(0.12, extra * 0.15), fovDelta: 0 };
}

export function adaptView(view: CameraState, aspect: number): CameraState {
  const { distanceScale, fovDelta } = framingForAspect(aspect);
  return {
    position: [
      view.target[0] + (view.position[0] - view.target[0]) * distanceScale,
      view.target[1] + (view.position[1] - view.target[1]) * distanceScale,
      view.target[2] + (view.position[2] - view.target[2]) * distanceScale,
    ],
    target: view.target,
    fov: Math.min(52, Math.max(22, view.fov + fovDelta)),
  };
}

/** HUD controls that must not abort the tour (the Play/Stop button handles itself). */
export const TOUR_IGNORE_SELECTOR = '[data-field-tour-control], .scene-toggles';
/** Area markers sit in a DOM overlay, not on the WebGL canvas. */
export const TOUR_FORCE_SELECTOR = '.area-marker, [data-area]';
export const TOUR_CANVAS_SELECTOR = 'canvas, .reveal-canvas';
const TYPING_SELECTOR = 'input, textarea, select, [contenteditable="true"]';

const INTERRUPT_TYPES = new Set(['pointerdown', 'wheel', 'touchstart', 'keydown']);

function isTypingTarget(el: Element | null): boolean {
  return !!el?.closest(TYPING_SELECTOR);
}

function keyShouldInterrupt(ev: { key?: string; metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean }): boolean {
  if (ev.metaKey || ev.ctrlKey || ev.altKey) return false;
  const key = ev.key ?? '';
  if (key === 'Escape') return true;
  if (['Shift', 'Control', 'Alt', 'Meta', 'Tab', 'CapsLock', 'Fn', 'NumLock', 'ScrollLock', 'Dead'].includes(key)) {
    return false;
  }
  return key.length > 0;
}

/**
 * Pure helper used by the live listener and by unit tests: should this event
 * abort a running tour and hand the camera back to the viewer?
 */
export function isTourInterrupt(
  ev: { type: string; target?: EventTarget | null; key?: string; metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean },
  opts: { playing: boolean },
): boolean {
  if (!opts.playing) return false;
  if (!INTERRUPT_TYPES.has(ev.type)) return false;
  const el = ev.target instanceof Element ? ev.target : null;
  if (el?.closest(TOUR_IGNORE_SELECTOR)) return false;
  if (isTypingTarget(el)) return false;
  if (ev.type === 'keydown') return keyShouldInterrupt(ev);
  if (el?.closest(TOUR_FORCE_SELECTOR)) return true;
  if (el?.closest(TOUR_CANVAS_SELECTOR)) return true;
  return false;
}

export type TourInterruptHandle = {
  stop: () => void;
  /** Test hook: feed a synthetic event through the same path as the listener. */
  handleEvent: (ev: Event) => void;
};

/**
 * Capture-phase listeners so area-marker clicks are seen even when the
 * marker stops bubbling. The Play button is ignored here so its click can
 * toggle without a pointerdown/click fight (stop then start again).
 */
export function attachTourInterrupts(
  target: EventTarget,
  opts: { isPlaying: () => boolean; onStop: () => void },
): TourInterruptHandle {
  const handleEvent = (ev: Event) => {
    const rec = ev as Event & { key?: string; metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean };
    if (isTourInterrupt(rec, { playing: opts.isPlaying() })) {
      opts.onStop();
    }
  };
  const types = ['pointerdown', 'wheel', 'touchstart', 'keydown'] as const;
  for (const type of types) {
    target.addEventListener(type, handleEvent, { capture: true, passive: false });
  }
  const stop = () => {
    for (const type of types) {
      target.removeEventListener(type, handleEvent, { capture: true });
    }
  };
  return { stop, handleEvent };
}
