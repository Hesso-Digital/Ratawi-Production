import { DEFAULT_QUALITY, DEFAULT_VIEW } from '../config';
import { GAS_STEP2_MMSCFD } from './openInputs';
import type { AppState, MonthPoint, Snapshot } from './types';

/**
 * The brief and design frames call this the "Commitment" (not "Budget").
 * Kept as BUDGET_KBOPD for compatibility with existing imports; COMMITMENT_KBOPD
 * is the preferred name going forward (plan section 2 / open input #7).
 */
export const BUDGET_KBOPD = 90;
export const COMMITMENT_KBOPD = BUDGET_KBOPD;
export const TARGET_KBOPD = 120;

export const LIMITS = {
  bsw: 0.5,
  salt: 270,
} as const;

/** Fixed operating rule (not one of the plan's open inputs): AG-25 needs this much gas to run. */
export const GAS_MIN_TO_OPERATE_MMSCFD = 50;

/** Current snapshot from the requirements document, 16 Nov 2026. */
export const BASELINE: Snapshot = {
  oil: 105,
  wells: 25,
  exportKbopd: 103,
  gas: 0,
  bsw: 0.08,
  salt: 121,
  efficiency: 98.6,
};

export const STEP_1: Snapshot = {
  ...BASELINE,
  oil: 110,
  wells: 25,
  exportKbopd: 108,
  gas: 0,
};

/**
 * Step 2 gas: the repo assumed 50 MMscfd, the approved design frames show 52.
 * Single source of truth lives in src/data/openInputs.ts (open input #3) so this
 * stays easy to flip once Mohammad/Gulmira confirm the real figure.
 */
export const STEP_2: Snapshot = {
  ...BASELINE,
  oil: 120,
  wells: 32,
  exportKbopd: 118,
  gas: GAS_STEP2_MMSCFD,
};

export const STEPS = [BASELINE, STEP_1, STEP_2] as const;

/**
 * June 2026 to April 2027 series from the requirements document.
 * January to April wells, export and gas were not specified; those companion
 * values after December are assumed (32 wells, export two below oil, gas 50).
 */
export const TRAJECTORY: MonthPoint[] = [
  { key: '2026-06', label: 'Jun', year: 2026, monthIndex: 0, oil: 0, wells: 0, exportKbopd: 0, gas: 0, kind: 'actual' },
  { key: '2026-07', label: 'Jul', year: 2026, monthIndex: 1, oil: 34, wells: 8, exportKbopd: 32, gas: 0, kind: 'actual' },
  { key: '2026-08', label: 'Aug', year: 2026, monthIndex: 2, oil: 61, wells: 14, exportKbopd: 59, gas: 0, kind: 'actual' },
  { key: '2026-09', label: 'Sep', year: 2026, monthIndex: 3, oil: 86, wells: 19, exportKbopd: 84, gas: 0, kind: 'actual' },
  { key: '2026-10', label: 'Oct', year: 2026, monthIndex: 4, oil: 108, wells: 24, exportKbopd: 106, gas: 0, kind: 'actual' },
  { key: '2026-11', label: 'Nov', year: 2026, monthIndex: 5, oil: 105, wells: 25, exportKbopd: 103, gas: 0, kind: 'actual' },
  { key: '2026-12', label: 'Dec', year: 2026, monthIndex: 6, oil: 120, wells: 32, exportKbopd: 118, gas: 50, kind: 'forecast' },
  { key: '2027-01', label: 'Jan', year: 2027, monthIndex: 7, oil: 123, wells: 32, exportKbopd: 121, gas: 50, kind: 'forecast' },
  { key: '2027-02', label: 'Feb', year: 2027, monthIndex: 8, oil: 125, wells: 32, exportKbopd: 123, gas: 50, kind: 'forecast' },
  { key: '2027-03', label: 'Mar', year: 2027, monthIndex: 9, oil: 127, wells: 32, exportKbopd: 125, gas: 50, kind: 'forecast' },
  { key: '2027-04', label: 'Apr', year: 2027, monthIndex: 10, oil: 130, wells: 32, exportKbopd: 128, gas: 50, kind: 'forecast' },
];

export const TODAY_INDEX = 5;
export const PLAYBACK_END_INDEX = 6;

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function snapshotAtPlayback(progress: number): Snapshot {
  const max = PLAYBACK_END_INDEX;
  const idx = progress * max;
  const lo = Math.min(Math.floor(idx), max);
  const hi = Math.min(lo + 1, max);
  const t = lo === hi ? 0 : idx - lo;
  const a = TRAJECTORY[lo];
  const b = TRAJECTORY[hi];
  return {
    oil: lerp(a.oil, b.oil, t),
    wells: lerp(a.wells, b.wells, t),
    exportKbopd: lerp(a.exportKbopd, b.exportKbopd, t),
    gas: lerp(a.gas, b.gas, t),
    bsw: BASELINE.bsw,
    salt: BASELINE.salt,
    efficiency: BASELINE.efficiency,
  };
}

export function defaultState(): AppState {
  return {
    snapshot: { ...BASELINE },
    prevSnapshot: { ...BASELINE },
    step: 0,
    origin: 'mock',
    cue: { kind: 'idle', startedAt: Date.now() },
    view: DEFAULT_VIEW,
    quality: DEFAULT_QUALITY,
  };
}
