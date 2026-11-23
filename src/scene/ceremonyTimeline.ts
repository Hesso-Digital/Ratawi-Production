/**
 * Ceremony choreography: a pure function of (cue, elapsed time, from, to).
 * Ported from the approved design-3d prototype's `src/timeline.js`, with the
 * fixed KPI table replaced by the operator's actual `prevSnapshot` → `snapshot`
 * values (plan section 5), so a manual override during rehearsal always drives
 * the same visuals a live PI value would.
 *
 * Deterministic and GPU-free on purpose: a late-joining or refreshed audience
 * window can resume exactly mid-sequence (elapsed = now - cue.startedAt), and
 * this file is unit-testable without a renderer (see ceremonyTimeline.test.ts).
 */
import { CatmullRomCurve3, Vector3 } from 'three';
import { TARGET_KBOPD } from '../data/defaults';
import type { Cue, CueKind, Snapshot } from '../data/types';

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ramp = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
/** Cubic in/out, same curve GSAP's `power3.inOut`-ish feel used across the HUD. */
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
const easeOut = (x: number) => 1 - (1 - x) ** 3;

/** Beat times in seconds, matching design-3d/src/timeline.js BEATS. */
export const BEATS = {
  countdownStart: 4.9,
  valves: 7.3,
  step1End: 8.9,
  step2: 9.0,
  agupWaveEnd: 10.0,
  agupFlowStart: 9.3,
  agupFlowEnd: 11.0,
  gasFlowStart: 10.6,
  gasFlowEnd: 11.8,
  gasValueStart: 10.9,
  gasValueEnd: 12.2,
  climbStart: 10.8,
  milestone: 12.4,
  goldSettle: 13.3,
  sequenceEnd: 20,
  idleLoopS: 4.5,
  step1DriftS: 3.4,
  orbitLoopS: 3.5,
  /** Countdown "3, 2, 1" holds here if Step 1 isn't clicked (plan section 5). */
  countdownHoldS: 2.39,
} as const;

type CameraKey = { t: number; pos: [number, number, number]; target: [number, number, number]; fov: number };

const CAMERA_KEYS: CameraKey[] = [
  { t: 0.0, pos: [-118, 94, 44], target: [2, 0, 2], fov: 30 },
  { t: 4.5, pos: [-110, 88, 36], target: [1, 0, 3], fov: 30 },
  { t: 8.4, pos: [-58, 40, 40], target: [-4, 0, 9], fov: 31 },
  { t: 12.4, pos: [-66, 48, 34], target: [-1, 0, 3], fov: 31 },
  { t: 16.5, pos: [-104, 82, 22], target: [2, 0, 2], fov: 30 },
  { t: 20.0, pos: [-110, 88, 10], target: [3, 0, 1], fov: 30 },
];

const posCurve = new CatmullRomCurve3(
  CAMERA_KEYS.map((k) => new Vector3(...k.pos)),
  false,
  'centripetal',
);
const targetCurve = new CatmullRomCurve3(
  CAMERA_KEYS.map((k) => new Vector3(...k.target)),
  false,
  'centripetal',
);

export type CameraState = { position: [number, number, number]; target: [number, number, number]; fov: number };

export function cameraAt(tRaw: number): CameraState {
  const t = clamp(tRaw, 0, BEATS.sequenceEnd);
  let i = 0;
  while (i < CAMERA_KEYS.length - 2 && t > CAMERA_KEYS[i + 1].t) i++;
  const a = CAMERA_KEYS[i];
  const b = CAMERA_KEYS[i + 1];
  const local = easeInOut(ramp(t, a.t, b.t));
  const u = (i + local) / (CAMERA_KEYS.length - 1);
  const pos = posCurve.getPoint(u);
  const target = targetCurve.getPoint(u);
  return {
    position: [pos.x, pos.y, pos.z],
    target: [target.x, target.y, target.z],
    fov: a.fov + (b.fov - a.fov) * local,
  };
}

/**
 * Maps (cue kind, elapsed seconds since the cue started) to a scene time `t`
 * on the same 0–20s scale as the approved prototype. See integration-plan.md
 * section 5 for the table this implements.
 */
export function sceneTimeFor(cue: Cue, elapsedS: number): number {
  switch (cue.kind) {
    case 'idle':
      return elapsedS % BEATS.idleLoopS;
    case 'countdown':
      return Math.min(BEATS.countdownStart + elapsedS, BEATS.valves - 0.01);
    case 'step1': {
      const raw = BEATS.valves + elapsedS;
      if (raw <= BEATS.step1End) return raw;
      // Idle hold near the step-1 framing, with a slow drift inside the same
      // camera segment so the shot never looks frozen between operator clicks.
      const drift = BEATS.step1End + 0.4 * Math.sin(elapsedS * 0.6);
      return clamp(drift, BEATS.valves, BEATS.step2 + BEATS.step1DriftS);
    }
    case 'step2': {
      const raw = BEATS.step2 + elapsedS;
      if (raw <= BEATS.sequenceEnd) return raw;
      const orbitElapsed = elapsedS - (BEATS.sequenceEnd - BEATS.step2);
      return BEATS.sequenceEnd - BEATS.orbitLoopS + (orbitElapsed % BEATS.orbitLoopS);
    }
    case 'playback':
      // The ribbon/HUD carries the story during playback; park the camera on
      // the establishing shot so the 3D field still reads behind the ribbon.
      return 3;
    default:
      return 0;
  }
}

export type CountdownState = { n: number; prog: number } | null;

function countdownAt(cue: Cue, elapsedS: number): CountdownState {
  if (cue.kind !== 'countdown') return null;
  const local = Math.min(elapsedS, BEATS.countdownHoldS);
  const k = local / 0.8;
  return { n: Math.max(0, 3 - Math.floor(k)), prog: k - Math.floor(k) };
}

export type AgupIgnite = 0 | 1 | 2;

export type SceneState = {
  cueKind: CueKind;
  /** Scene time on the shared 0–20s choreography scale. */
  t: number;
  camera: CameraState;
  countdown: CountdownState;
  agupIgnite: AgupIgnite;
  /** 0→1 fraction of the 7 AGUP wells visually switched on. */
  agupWave: number;
  /** 0→1 flow progress of oil racing from the AGUP wells to CPF-1. */
  agupFlow: number;
  /** 0→1 flow progress of gas racing from CPF-1 to AG-25. */
  gasFlow: number;
  oil: number;
  wells: number;
  exportKbopd: number;
  gas: number;
  bsw: number;
  salt: number;
  efficiency: number;
  /** 0→1 grade of the gold milestone look (sky, rim light, bloom, wells). */
  gold: number;
  /** Short decaying pulse right at the milestone instant, for a bloom kick. */
  bloomPulse: number;
  step: 0 | 1 | 2 | 3;
};

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/**
 * The single entry point the scene and the HUD both read every frame.
 * `from`/`to` are the store's `prevSnapshot`/`snapshot`: the cue animates
 * from the value that was on screen when the cue started to the operator's
 * new target, so a manual value and a live one animate identically.
 */
export function sceneStateAt(cue: Cue, elapsedS: number, from: Snapshot, to: Snapshot): SceneState {
  const t = sceneTimeFor(cue, elapsedS);
  const camera = cameraAt(t);
  const countdown = countdownAt(cue, elapsedS);

  let agupIgnite: AgupIgnite = 0;
  let agupWave = 0;
  let agupFlow = 0;
  let gasFlow = 0;
  let oil = to.oil;
  let wells = to.wells;
  let exportKbopd = to.exportKbopd;
  let gas = to.gas;

  if (cue.kind === 'step1') {
    agupIgnite = 1;
    const s1 = easeOut(ramp(t, BEATS.valves, 8.4));
    oil = lerp(from.oil, to.oil, s1);
    exportKbopd = lerp(from.exportKbopd, to.exportKbopd, s1);
    wells = lerp(from.wells, to.wells, s1);
    gas = lerp(from.gas, to.gas, s1);
  } else if (cue.kind === 'step2') {
    agupIgnite = 2;
    agupWave = ramp(t, BEATS.step2, BEATS.agupWaveEnd);
    agupFlow = easeInOut(ramp(t, BEATS.agupFlowStart, BEATS.agupFlowEnd));
    gasFlow = easeInOut(ramp(t, BEATS.gasFlowStart, BEATS.gasFlowEnd));
    const s2 = easeInOut(ramp(t, BEATS.climbStart, BEATS.milestone));
    const gasProgress = easeOut(ramp(t, BEATS.gasValueStart, BEATS.gasValueEnd));
    oil = lerp(from.oil, to.oil, s2);
    exportKbopd = lerp(from.exportKbopd, to.exportKbopd, s2);
    wells = lerp(from.wells, to.wells, agupWave);
    gas = lerp(from.gas, to.gas, gasProgress);
  } else if (cue.kind === 'countdown') {
    agupIgnite = 0;
    oil = from.oil;
    exportKbopd = from.exportKbopd;
    wells = from.wells;
    gas = from.gas;
  } else if (cue.kind === 'playback') {
    agupIgnite = to.wells > 25.5 ? 2 : 0;
  } else {
    // idle: current snapshot, no ramp (reset / manual apply / baseline hold)
    agupIgnite = to.wells > 25.5 ? 2 : 0;
  }

  // Gold is data-driven (plan section 5): it is never hard-coded to a time.
  // The step2 cue gets a short cinematic ease once the ramp lands on target;
  // every other cue (idle/manual override, a rehearsal jump, etc.) that ends
  // up at/above target shows gold immediately, with no animation to invent.
  const reachedTarget = oil >= TARGET_KBOPD - 1e-6;
  const gold = reachedTarget ? (cue.kind === 'step2' ? easeInOut(ramp(t, BEATS.milestone, BEATS.goldSettle)) : 1) : 0;
  const bloomPulse =
    cue.kind === 'step2' && t >= BEATS.milestone ? 0.9 * Math.exp(-(t - BEATS.milestone) * 1.6) : 0;

  const step: SceneState['step'] =
    cue.kind === 'idle' || cue.kind === 'countdown'
      ? 0
      : cue.kind === 'step1'
        ? 1
        : gold >= 0.999
          ? 3
          : 2;

  return {
    cueKind: cue.kind,
    t,
    camera,
    countdown,
    agupIgnite,
    agupWave,
    agupFlow,
    gasFlow,
    oil,
    wells,
    exportKbopd,
    gas,
    bsw: to.bsw,
    salt: to.salt,
    efficiency: to.efficiency,
    gold,
    bloomPulse,
    step,
  };
}
