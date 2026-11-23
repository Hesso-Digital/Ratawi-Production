import { VENUE } from './data/ceremonyConfig';

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
export const DEFAULT_QUALITY: 'low' | 'medium' | 'high' = VENUE.defaultQuality;
