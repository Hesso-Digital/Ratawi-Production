/**
 * The approved design frames (F1–F6, plus F2b), expressed as (cue, elapsed,
 * from, to) tuples in this build's cue model, so `?frame=F4` reproduces the
 * same beat the design-3d prototype's `render.mjs --frame F4` did. Also
 * supports a generic `?t=<seconds>` on the same 0–20s scale as the prototype.
 * Used by RevealAudience for rehearsal deep-links and by e2e/reveal.spec.ts
 * for the comparison screenshots.
 */
import { BASELINE, STEP_1, STEP_2 } from '../data/defaults';
import type { Cue, Snapshot } from '../data/types';
import { BEATS, type CameraState } from './ceremonyTimeline';

export type FramePreset = {
  cueKind: Cue['kind'];
  elapsedS: number;
  from: Snapshot;
  to: Snapshot;
  cameraOverride?: CameraState;
  showRibbon?: boolean;
};

const CLOSEUP_CAMERA: CameraState = { position: [-21, 9.5, 15], target: [2.2, 0.6, -5.5], fov: 32 };
const RIBBON_CAMERA: CameraState = { position: [-92, 26, 8], target: [0, 9, 4], fov: 34 };

export const FRAME_PRESETS: Record<string, FramePreset> = {
  F1: { cueKind: 'idle', elapsedS: 3.0, from: BASELINE, to: BASELINE },
  F2: { cueKind: 'step1', elapsedS: 8.45 - BEATS.valves, from: BASELINE, to: STEP_1 },
  F2b: { cueKind: 'countdown', elapsedS: 6.1 - BEATS.countdownStart, from: BASELINE, to: STEP_1 },
  F3: { cueKind: 'step2', elapsedS: 10.95 - BEATS.step2, from: STEP_1, to: STEP_2 },
  F4: { cueKind: 'step2', elapsedS: 13.7 - BEATS.step2, from: STEP_1, to: STEP_2 },
  F5: { cueKind: 'step2', elapsedS: 15.0 - BEATS.step2, from: STEP_1, to: STEP_2, cameraOverride: CLOSEUP_CAMERA },
  F6: {
    cueKind: 'playback',
    elapsedS: 0,
    from: STEP_1,
    to: STEP_2,
    cameraOverride: RIBBON_CAMERA,
    showRibbon: true,
  },
};

/** `?t=<seconds>` on the same 0–20s global scale the design-3d prototype used. */
export function presetForGlobalTime(t: number): FramePreset {
  if (t < BEATS.countdownStart) return { cueKind: 'idle', elapsedS: t, from: BASELINE, to: BASELINE };
  if (t < BEATS.valves) return { cueKind: 'countdown', elapsedS: t - BEATS.countdownStart, from: BASELINE, to: STEP_1 };
  if (t < BEATS.step2) return { cueKind: 'step1', elapsedS: t - BEATS.valves, from: BASELINE, to: STEP_1 };
  return { cueKind: 'step2', elapsedS: t - BEATS.step2, from: STEP_1, to: STEP_2 };
}
