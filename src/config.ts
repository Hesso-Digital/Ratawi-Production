/** Client-side operator PIN. Hidden console only, not a security boundary. */
export const OPERATOR_PIN = '12026';

export const STORAGE_KEY = 'ratawi_production_state_v1';
export const CHANNEL_NAME = 'ratawi-production';

/** Playback of June to December, in milliseconds. */
export const PLAYBACK_MS = 9000;

/** Design artboard. The stage scales this 16:9 frame to the viewport. */
export const STAGE_WIDTH = 1920;
export const STAGE_HEIGHT = 1080;

/**
 * Which audience view `/` shows by default, and the default 3D quality.
 * Both are operator-switchable at runtime (broadcast through the store).
 */
export const DEFAULT_VIEW: 'reveal' | 'classic' | 'fallback' = 'reveal';
export const DEFAULT_QUALITY: 'low' | 'medium' | 'high' = 'medium';

/**
 * Ceremony cue timings, in seconds, matching the approved design-3d prototype's
 * `timeline.js` (BEATS). Kept as one place so the operator console, the scene
 * timeline and the docs agree on the same numbers.
 */
export const REVEAL_TIMINGS = {
  /** Countdown "3, 2, 1": about 0.8s per number. */
  countdownStepS: 0.8,
  countdownTotalS: 2.4,
  /** Step 1 (valves open, 105/110 climb): time to settle after the click. */
  step1ClimbS: 1.1,
  /** Step 2 (AGUP + gas, climb to 120 and the gold milestone): full sequence. */
  step2SequenceS: 3.4,
  step2TotalS: 11,
} as const;
