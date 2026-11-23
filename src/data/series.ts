/**
 * June to December 2026 series for the interactive charts on the hall screen.
 * Every number comes from the existing scenario data: TRAJECTORY and the
 * BASELINE / STEP_1 / STEP_2 snapshots in defaults.ts, and MONTHLY_QUALITY and
 * GAS in ceremonyConfig.ts. Nothing new is invented here.
 */
import { GAS, MONTHLY_QUALITY, WELLS as WELL_CONFIG } from './ceremonyConfig';
import {
  BASELINE,
  BUDGET_KBOPD,
  GAS_MIN_TO_OPERATE_MMSCFD,
  LIMITS,
  PLAYBACK_END_INDEX,
  STEP_1,
  STEP_2,
  TARGET_KBOPD,
  TODAY_INDEX,
  TRAJECTORY,
} from './defaults';
import type { KpiId } from './kpis';
import type { Snapshot } from './types';

/** The replay window: June (0) to December (6). */
export const MONTHS = TRAJECTORY.slice(0, PLAYBACK_END_INDEX + 1);
export { TODAY_INDEX };

export type RefLine = { value: number; label: string; tone: 'commit' | 'target' | 'limit' | 'min' };

export type KpiSeries = {
  id: KpiId;
  values: number[];
  /** Fixed y range so the chart doesn't jump while values animate. */
  domain: [number, number];
  refs: RefLine[];
  tone: 'oil' | 'gas' | 'quality' | 'export';
};

const monthly = (key: keyof Snapshot): number[] =>
  MONTHS.map((m, i) => {
    if (key === 'bsw' || key === 'salt' || key === 'efficiency') return MONTHLY_QUALITY[i][key];
    return m[key as 'oil' | 'wells' | 'exportKbopd' | 'gas'];
  });

export const KPI_SERIES: Record<KpiId, KpiSeries> = {
  oil: {
    id: 'oil',
    values: monthly('oil'),
    domain: [0, 130],
    refs: [
      { value: BUDGET_KBOPD, label: `Commitment ${BUDGET_KBOPD}`, tone: 'commit' },
      { value: TARGET_KBOPD, label: `Target ${TARGET_KBOPD}`, tone: 'target' },
    ],
    tone: 'oil',
  },
  wells: {
    id: 'wells',
    values: monthly('wells'),
    domain: [0, WELL_CONFIG.total],
    refs: [{ value: WELL_CONFIG.total, label: `All ${WELL_CONFIG.total} wells`, tone: 'target' }],
    tone: 'oil',
  },
  export: {
    id: 'export',
    values: monthly('exportKbopd'),
    domain: [0, 130],
    refs: [{ value: STEP_2.exportKbopd, label: `Step 2 · ${STEP_2.exportKbopd}`, tone: 'target' }],
    tone: 'export',
  },
  gas: {
    id: 'gas',
    values: monthly('gas'),
    domain: [0, 60],
    refs: [{ value: GAS_MIN_TO_OPERATE_MMSCFD, label: `AG-25 min ${GAS_MIN_TO_OPERATE_MMSCFD}`, tone: 'min' }],
    tone: 'gas',
  },
  bsw: {
    id: 'bsw',
    values: monthly('bsw'),
    domain: [0, 0.6],
    refs: [{ value: LIMITS.bsw, label: `Limit ${LIMITS.bsw}`, tone: 'limit' }],
    tone: 'quality',
  },
  salt: {
    id: 'salt',
    values: monthly('salt'),
    domain: [0, 300],
    refs: [{ value: LIMITS.salt, label: `Limit ${LIMITS.salt}`, tone: 'limit' }],
    tone: 'quality',
  },
  efficiency: {
    id: 'efficiency',
    values: monthly('efficiency'),
    domain: [0, 100],
    refs: [],
    tone: 'quality',
  },
};

/** Value of a series at a fractional month index (for the scrubber). */
export function valueAt(values: number[], index: number): number {
  const i = Math.max(0, Math.min(values.length - 1, index));
  const lo = Math.floor(i);
  const hi = Math.min(values.length - 1, lo + 1);
  return values[lo] + (values[hi] - values[lo]) * (i - lo);
}

/** Oil build-up for the ceremony, straight from the three snapshots. */
export const OIL_STEPS = [
  { label: 'Today · 25 wells', value: BASELINE.oil, delta: BASELINE.oil },
  { label: 'Step 1 · valves open', value: STEP_1.oil, delta: STEP_1.oil - BASELINE.oil },
  { label: 'Step 2 · 7 AGUP wells', value: STEP_2.oil, delta: STEP_2.oil - STEP_1.oil },
] as const;

export const GAS_STEP2 = GAS.step2Mmscfd;
