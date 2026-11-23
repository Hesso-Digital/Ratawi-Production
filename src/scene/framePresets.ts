/**
 * Named camera frames and beats for rehearsal deep-links and screenshots:
 * `?frame=F1..F6|F2b` freezes the hall view at a point on the scenario, and
 * `?t=<seconds>` does the same on the scenario clock (see src/data/scenario.ts).
 * Used by RevealAudience and by e2e/reveal.spec.ts.
 */
import { BASELINE, STEP_1, STEP_2 } from '../data/defaults';
import { BEATS, COUNTDOWN_DURATION_S } from '../data/scenario';
import { PLAYBACK_MS } from '../config';
import type { Cue, Snapshot } from '../data/types';
import { RIBBON_CAMERA, type CameraState } from './ceremonyTimeline';

export type FramePreset = {
  cueKind: Cue['kind'];
  elapsedS: number;
  from: Snapshot;
  to: Snapshot;
  cameraOverride?: CameraState;
};

const CLOSEUP_CAMERA: CameraState = { position: [-21, 9.5, 15], target: [2.2, 0.6, -5.5], fov: 32 };

const step1At = (T: number): FramePreset => ({ cueKind: 'step1', elapsedS: T - BEATS.step1Start, from: BASELINE, to: STEP_1 });
const step2At = (T: number): FramePreset => ({ cueKind: 'step2', elapsedS: T - BEATS.step2Start, from: STEP_1, to: STEP_2 });

export const FRAME_PRESETS: Record<string, FramePreset> = {
  /** Establishing shot, 105 kbopd. */
  F1: { cueKind: 'idle', elapsedS: 2.25, from: BASELINE, to: BASELINE },
  /** Step 1: valves open, flow to CPF-1, oil on its way to 110. */
  F2: step1At(7.2),
  /** Countdown, on the "2". */
  F2b: { cueKind: 'countdown', elapsedS: 1.2, from: STEP_1, to: STEP_2 },
  /** Step 2: AGUP wells coming online, oil racing to CPF-1. */
  F3: step2At(13.6),
  /** The 120 gold moment. */
  F4: step2At(BEATS.milestone + 0.5),
  /** Close-up on CPF-1 and AG-25 with gas flowing. */
  F5: { ...step2At(BEATS.milestone + 1.5), cameraOverride: CLOSEUP_CAMERA },
  /** Replay finished: the full June to December ribbon. */
  F6: { cueKind: 'playback', elapsedS: PLAYBACK_MS / 1000 + 1, from: STEP_2, to: STEP_2, cameraOverride: RIBBON_CAMERA },
};

/** `?t=<seconds>` on the scenario clock (0 to the end of the Step 2 sequence). */
export function presetForGlobalTime(t: number): FramePreset {
  if (t < BEATS.step1Start) return { cueKind: 'idle', elapsedS: t, from: BASELINE, to: BASELINE };
  if (t < BEATS.countdownStart) return step1At(t);
  if (t < BEATS.countdownStart + COUNTDOWN_DURATION_S) {
    return { cueKind: 'countdown', elapsedS: t - BEATS.countdownStart, from: STEP_1, to: STEP_2 };
  }
  return step2At(t);
}
