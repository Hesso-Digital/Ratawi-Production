/**
 * Ceremony choreography: a pure function of (cue, elapsed time, from, to).
 * The beats live in src/data/scenario.ts; this file turns them into one
 * `SceneState` that the 3D scene, the HUD, the tiles and the classic and 2D
 * fallback screens all read, so every number moves with the same storyline.
 * The cue animates from `prevSnapshot` to `snapshot`, so a live feed or a typed
 * value drives the same visuals.
 *
 * Deterministic and GPU-free on purpose: a late-joining or refreshed audience
 * window resumes exactly mid-sequence (elapsed = now - cue.startedAt), and this
 * file is unit-testable without a renderer (see ceremonyTimeline.test.ts).
 */
import { CatmullRomCurve3, Vector3 } from 'three';
import { PLAYBACK_MS } from '../config';
import { BASELINE, COMMITMENT_KBOPD, PLAYBACK_END_INDEX, TARGET_KBOPD, snapshotAtPlayback } from '../data/defaults';
import { BEATS, COUNTDOWN_DURATION_S } from '../data/scenario';
import type { Cue, CueKind, DataPresets, Snapshot } from '../data/types';

export { BEATS };

/** Smooth return from AGUP online back to Current. */
export const LIVE_DURATION_S = 2.2;

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ramp = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
const easeOut = (x: number) => 1 - (1 - x) ** 3;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

type CameraKey = { t: number; pos: [number, number, number]; target: [number, number, number]; fov: number };

const CAMERA_KEYS: CameraKey[] = [
  { t: 0.0, pos: [-100, 80, 38], target: [2, 0, 2], fov: 30 },
  { t: 4.5, pos: [-94, 75, 31], target: [1, 0, 3], fov: 30 },
  { t: 8.4, pos: [-58, 40, 40], target: [-4, 0, 9], fov: 31 },
  { t: 10.0, pos: [-56, 39, 39], target: [-4, 0, 8.5], fov: 31 },
  { t: 12.4, pos: [-70, 52, 38], target: [-2, 0, 4], fov: 31 },
  { t: 16.2, pos: [-66, 48, 34], target: [-1, 0, 3], fov: 31 },
  { t: 21.0, pos: [-90, 70, 19], target: [2, 0, 2], fov: 30 },
  { t: 26.0, pos: [-94, 75, 9], target: [3, 0, 1], fov: 30 },
];
const CAMERA_END = CAMERA_KEYS[CAMERA_KEYS.length - 1].t;

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
  const t = clamp(tRaw, 0, CAMERA_END);
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

export type CountdownState = { n: number; prog: number } | null;
export type AgupIgnite = 0 | 1 | 2;

export type PlaybackState = {
  /** 0→1 across the June to December replay, held at 1 once it has finished. */
  progress: number;
  /** Fractional TRAJECTORY index the replay is at (0 = Jun, 6 = Dec). */
  index: number;
  done: boolean;
};

export type SceneState = {
  cueKind: CueKind;
  /** Animation clock for pulses and particles. Monotonic within a cue. */
  t: number;
  /** Position on the shared scenario clock that drives the camera. */
  camT: number;
  camera: CameraState;
  countdown: CountdownState;
  /** 0→1 opening of the CPF-1 inlet valves (Step 1). */
  valves: number;
  /** 0→1 brightness/flow of the existing gathering lines to CPF-1. */
  oilFlow: number;
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
  /** Seconds since the 120 milestone fired (negative or very large when not in play). */
  milestoneSince: number;
  /** Short decaying pulse right at the milestone instant, for a bloom kick. */
  bloomPulse: number;
  step: 0 | 1 | 2 | 3;
  playback: PlaybackState | null;
  commitmentKbopd: number;
  targetKbopd: number;
  currentWells: number;
  agupWells: number;
};

export type SceneLines = Pick<DataPresets, 'commitmentKbopd' | 'targetKbopd'> & {
  currentWells?: number;
  agupWells?: number;
};

const DEFAULT_LINES: SceneLines = {
  commitmentKbopd: COMMITMENT_KBOPD,
  targetKbopd: TARGET_KBOPD,
  currentWells: BASELINE.wells,
  agupWells: 32,
};

const valvesOpenIn = (s: Snapshot) => s.oil > BASELINE.oil + 0.5;
const agupOnlineIn = (s: Snapshot, currentWells = BASELINE.wells) => s.wells > currentWells + 0.5;
const goldIn = (s: Snapshot, target = TARGET_KBOPD) => s.oil >= target - 1e-6;

function stepOf(s: Snapshot, lines: SceneLines = DEFAULT_LINES): SceneState['step'] {
  if (goldIn(s, lines.targetKbopd)) return 3;
  if (agupOnlineIn(s, lines.currentWells ?? BASELINE.wells)) return 2;
  if (valvesOpenIn(s)) return 1;
  return 0;
}

/** Framing for the June to December replay: the ribbon fills the upper field. */
export const RIBBON_CAMERA: CameraState = { position: [-100, 36, 8], target: [-30, 12.5, 8], fov: 34 };

/** Where the replay ribbon stands, in world units: a vertical plane facing RIBBON_CAMERA. */
export const RIBBON_LAYOUT = { x: -30, zCenter: 18, width: 44, baseY: 6, yPerKbopd: 0.14 } as const;

function lerp3(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function blendCamera(a: CameraState, b: CameraState, t: number): CameraState {
  return { position: lerp3(a.position, b.position, t), target: lerp3(a.target, b.target, t), fov: lerp(a.fov, b.fov, t) };
}

/**
 * Where each cue sits on the scenario clock. `anim` drives pulses and
 * particles, `cam` drives the camera, `ceremonyT` is the scenario clock while a
 * ceremony beat is running (null for idle and playback).
 */
function clockFor(cue: Cue, el: number, to: Snapshot) {
  switch (cue.kind) {
    case 'step1': {
      const raw = BEATS.step1Start + el;
      const cam = raw <= BEATS.step1Settled ? raw : BEATS.step1Settled + BEATS.step1DriftS * (0.5 - 0.5 * Math.cos((el - (BEATS.step1Settled - BEATS.step1Start)) * 0.6));
      return { anim: raw, cam, ceremonyT: raw, inStep2: false };
    }
    case 'countdown': {
      if (el < COUNTDOWN_DURATION_S) {
        const T = BEATS.countdownStart + el;
        return { anim: T, cam: T, ceremonyT: T, inStep2: false };
      }
      const raw = BEATS.step2Start + (el - COUNTDOWN_DURATION_S);
      return { anim: raw, cam: step2Cam(raw), ceremonyT: raw, inStep2: true };
    }
    case 'step2': {
      const raw = BEATS.step2Start + el;
      return { anim: raw, cam: step2Cam(raw), ceremonyT: raw, inStep2: true };
    }
    case 'playback':
      return { anim: el, cam: 2.25 - 2.25 * Math.cos((el * Math.PI * 2) / 9), ceremonyT: null, inStep2: false };
    case 'live':
      return { anim: el, cam: 2.25 - 2.25 * Math.cos((el * Math.PI * 2) / 9), ceremonyT: null, inStep2: false };
    default: {
      if (agupOnlineIn(to)) {
        return { anim: el, cam: 21 + 5 * (0.5 - 0.5 * Math.cos((el * Math.PI * 2) / 14)), ceremonyT: null, inStep2: false };
      }
      if (valvesOpenIn(to)) {
        return {
          anim: el,
          cam: BEATS.step1Settled + BEATS.step1DriftS * (0.5 - 0.5 * Math.cos(el * 0.6)),
          ceremonyT: null,
          inStep2: false,
        };
      }
      return { anim: el, cam: 2.25 - 2.25 * Math.cos((el * Math.PI * 2) / 9), ceremonyT: null, inStep2: false };
    }
  }
}

function step2Cam(T: number) {
  if (T <= CAMERA_END) return T;
  const over = T - CAMERA_END;
  return 21 + 5 * (0.5 - 0.5 * Math.cos((over * Math.PI * 2) / 14 + Math.PI));
}

function countdownAt(cue: Cue, el: number): CountdownState {
  if (cue.kind !== 'countdown' || el >= COUNTDOWN_DURATION_S) return null;
  const k = el / BEATS.countdownStepS;
  return { n: Math.max(1, 3 - Math.floor(k)), prog: k - Math.floor(k) };
}

/** Elapsed seconds for a cue at wall-clock `now`. Never negative. */
export function elapsedFor(cue: Cue, now = Date.now()) {
  return Math.max(0, (now - cue.startedAt) / 1000);
}

/**
 * The single entry point the scene, the HUD, the tiles and the fallback views
 * read every frame. `from` and `to` are the store's `prevSnapshot` and `snapshot`.
 */
export function sceneStateAt(cue: Cue, el: number, from: Snapshot, to: Snapshot, lines: SceneLines = DEFAULT_LINES): SceneState {
  const commitmentKbopd = lines.commitmentKbopd ?? COMMITMENT_KBOPD;
  const targetKbopd = lines.targetKbopd ?? TARGET_KBOPD;
  const currentWells = lines.currentWells ?? BASELINE.wells;
  const agupWells = lines.agupWells ?? 32;
  const { anim, cam, ceremonyT, inStep2 } = clockFor(cue, el, to);
  let camera = cameraAt(cam);
  const countdown = countdownAt(cue, el);

  let valves = valvesOpenIn(to) ? 1 : 0;
  let oilFlow = valves;
  let agupIgnite: AgupIgnite = agupOnlineIn(to, currentWells) ? 2 : 0;
  let agupWave = agupOnlineIn(to, currentWells) ? 1 : 0;
  let agupFlow = agupOnlineIn(to, currentWells) ? 1 : 0;
  let gasFlow = to.gas > 0 ? 1 : 0;
  let oil = to.oil;
  let wells = to.wells;
  let exportKbopd = to.exportKbopd;
  let gas = to.gas;
  let bsw = to.bsw;
  let salt = to.salt;
  let efficiency = to.efficiency;
  let playback: PlaybackState | null = null;
  let step: SceneState['step'] = stepOf(to, lines);
  let gold = goldIn(to, targetKbopd) ? 1 : 0;
  let milestoneSince = gold > 0 ? 999 : -999;

  if (cue.kind === 'step1' && ceremonyT !== null) {
    valves = easeInOut(ramp(ceremonyT, BEATS.valvesOpenStart, BEATS.valvesOpenEnd));
    oilFlow = easeInOut(ramp(ceremonyT, BEATS.step1FlowStart, BEATS.step1FlowEnd));
    const climb = easeOut(ramp(ceremonyT, BEATS.step1ClimbStart, BEATS.step1ClimbEnd));
    oil = lerp(from.oil, to.oil, climb);
    exportKbopd = lerp(from.exportKbopd, to.exportKbopd, climb);
    wells = from.wells;
    gas = from.gas;
    agupIgnite = 0;
    agupWave = 0;
    agupFlow = 0;
    gasFlow = 0;
    gold = 0;
    milestoneSince = -999;
    step = 1;
  } else if ((cue.kind === 'countdown' || cue.kind === 'step2') && ceremonyT !== null) {
    const opened = inStep2 || valvesOpenIn(from);
    valves = opened ? 1 : 0;
    oilFlow = opened ? 1 : 0;
    if (!inStep2) {
      oil = from.oil;
      exportKbopd = from.exportKbopd;
      wells = from.wells;
      gas = from.gas;
      agupIgnite = 1;
      agupWave = 0;
      agupFlow = 0;
      gasFlow = 0;
      gold = 0;
      milestoneSince = -999;
      step = stepOf(from, lines);
    } else {
      agupIgnite = 2;
      agupWave = ramp(ceremonyT, BEATS.step2Start, BEATS.agupWaveEnd);
      agupFlow = easeInOut(ramp(ceremonyT, BEATS.agupFlowStart, BEATS.agupFlowEnd));
      gasFlow = easeInOut(ramp(ceremonyT, BEATS.gasFlowStart, BEATS.gasFlowEnd));
      const climb = easeInOut(ramp(ceremonyT, BEATS.climbStart, BEATS.milestone));
      const gasProgress = easeOut(ramp(ceremonyT, BEATS.gasValueStart, BEATS.gasValueEnd));
      oil = lerp(from.oil, to.oil, climb);
      exportKbopd = lerp(from.exportKbopd, to.exportKbopd, climb);
      wells = lerp(from.wells, to.wells, agupWave);
      gas = lerp(from.gas, to.gas, gasProgress);
      // Gold is data-driven: it only exists once oil has reached the target,
      // and the cue then eases it in rather than flipping it.
      gold = oil >= targetKbopd - 1e-6 ? easeInOut(ramp(ceremonyT, BEATS.milestone, BEATS.goldSettle)) : 0;
      milestoneSince = goldIn(to, targetKbopd) ? ceremonyT - BEATS.milestone : -999;
      step = gold >= 0.999 ? 3 : 2;
    }
  } else if (cue.kind === 'playback') {
    const progress = clamp((el * 1000) / PLAYBACK_MS);
    const snap = snapshotAtPlayback(progress);
    oil = snap.oil;
    wells = snap.wells;
    exportKbopd = snap.exportKbopd;
    gas = snap.gas;
    valves = 1;
    oilFlow = clamp(oil / BASELINE.oil);
    agupWave = clamp((wells - BASELINE.wells) / 7);
    agupFlow = agupWave > 0 ? 1 : 0;
    agupIgnite = agupWave > 0 ? 2 : 0;
    gasFlow = gas > 0 ? 1 : 0;
    const after = el - PLAYBACK_MS / 1000;
    gold = goldIn(snap, targetKbopd) ? easeInOut(ramp(after, 0, 0.8)) : 0;
    milestoneSince = goldIn(snap, targetKbopd) ? after : -999;
    step = stepOf(snap, lines);
    camera = blendCamera(camera, RIBBON_CAMERA, easeInOut(ramp(el, 0, 1.4)));
    playback = { progress, index: progress * PLAYBACK_END_INDEX, done: progress >= 1 };
  } else if (cue.kind === 'live') {
    const climb = easeInOut(clamp(el / LIVE_DURATION_S));
    oil = lerp(from.oil, to.oil, climb);
    exportKbopd = lerp(from.exportKbopd, to.exportKbopd, climb);
    wells = lerp(from.wells, to.wells, climb);
    gas = lerp(from.gas, to.gas, climb);
    bsw = lerp(from.bsw, to.bsw, climb);
    salt = lerp(from.salt, to.salt, climb);
    efficiency = lerp(from.efficiency, to.efficiency, climb);
    const span = Math.max(0.0001, agupWells - currentWells);
    agupWave = clamp((wells - currentWells) / span);
    agupFlow = agupWave;
    agupIgnite = agupWave > 0.02 ? 2 : 0;
    oilFlow = Math.max(oilFlow, easeInOut(climb));
    valves = oilFlow;
    gasFlow = gas > 0 ? 1 : easeOut(climb) * (from.gas > 0 ? 1 - climb : 0);
    gold = oil >= targetKbopd - 1e-6 ? easeInOut(climb) : gold * (1 - climb);
    milestoneSince = gold > 0.5 ? el : -999;
    step = stepOf({ ...to, oil, wells, exportKbopd, gas }, lines);
  }

  const bloomPulse = milestoneSince > 0 && milestoneSince < 999 ? 0.9 * Math.exp(-milestoneSince * 1.6) : 0;

  return {
    cueKind: cue.kind,
    t: anim,
    camT: cam,
    camera,
    countdown,
    valves,
    oilFlow,
    agupIgnite,
    agupWave,
    agupFlow,
    gasFlow,
    oil,
    wells,
    exportKbopd,
    gas,
    bsw,
    salt,
    efficiency,
    gold,
    milestoneSince,
    bloomPulse,
    step,
    playback,
    commitmentKbopd,
    targetKbopd,
    currentWells,
    agupWells,
  };
}
