/**
 * One KPI model shared by the classic grid (KpiTiles, HeroCard) and the reveal
 * HUD (KpiRail, HeroNumber), so wording and rules never drift between the two
 * screens. Values "look and behave identically whether they come live from PI
 * or are typed in" (requirements-summary.md): this module never looks at origin.
 */
import {
  BUDGET_KBOPD,
  GAS_MIN_TO_OPERATE_MMSCFD,
  LIMITS,
  TARGET_KBOPD,
} from './defaults';
import type { Snapshot } from './types';

export type KpiId = 'oil' | 'wells' | 'export' | 'gas' | 'bsw' | 'salt' | 'efficiency';

export type KpiDef = {
  id: KpiId;
  label: string;
  unit: string;
  decimals: number;
  value: (s: KpiSource) => number;
  sub: (s: KpiSource) => string;
  alert?: (s: KpiSource) => boolean;
  tone?: (s: KpiSource) => 'default' | 'gold' | 'gas';
};

export type KpiSource = Snapshot & {
  commitmentKbopd?: number;
  targetKbopd?: number;
  currentWells?: number;
  agupWells?: number;
};

export const isGold = (oil: number, target = TARGET_KBOPD) => oil >= target;
export const isAboveCommitment = (oil: number, commitment = BUDGET_KBOPD) => oil > commitment;
export const isGasOperating = (gas: number) => gas >= GAS_MIN_TO_OPERATE_MMSCFD;
export const isGasRamping = (gas: number) => gas > 0 && gas < GAS_MIN_TO_OPERATE_MMSCFD;

export const KPIS: KpiDef[] = [
  {
    id: 'oil',
    label: 'Oil production',
    unit: 'kbopd',
    decimals: 1,
    value: (s) => s.oil,
    sub: (s) => {
      const target = s.targetKbopd ?? TARGET_KBOPD;
      const commitment = s.commitmentKbopd ?? BUDGET_KBOPD;
      return isGold(s.oil, target) ? `Above ${target} AGUP target` : `Above ${commitment} target`;
    },
    tone: (s) => (isGold(s.oil, s.targetKbopd ?? TARGET_KBOPD) ? 'gold' : 'default'),
  },
  {
    id: 'wells',
    label: 'Wells online',
    unit: 'of 32',
    decimals: 0,
    value: (s) => s.wells,
    sub: (s) => {
      const current = s.currentWells ?? 25;
      const extra = Math.max(0, Math.round(s.wells - current));
      return s.wells > current + 0.5 ? `+${extra} AGUP online` : 'AGUP wells standing by';
    },
    tone: (s) => (s.wells > (s.currentWells ?? 25) + 0.5 ? (isGold(s.oil, s.targetKbopd ?? TARGET_KBOPD) ? 'gold' : 'default') : 'default'),
  },
  {
    id: 'export',
    label: 'Oil export',
    unit: 'kbopd',
    decimals: 1,
    value: (s) => s.exportKbopd,
    sub: () => 'Metered',
  },
  {
    id: 'gas',
    label: 'Gas to AG-25',
    unit: 'MMscfd',
    decimals: 0,
    value: (s) => s.gas,
    sub: (s) =>
      isGasOperating(s.gas)
        ? `Operating · min ${GAS_MIN_TO_OPERATE_MMSCFD}`
        : isGasRamping(s.gas)
          ? `Ramping · min ${GAS_MIN_TO_OPERATE_MMSCFD}`
          : `Standby · min ${GAS_MIN_TO_OPERATE_MMSCFD}`,
    tone: (s) => (s.gas > 0 ? 'gas' : 'default'),
  },
  {
    id: 'bsw',
    label: 'BSW · export',
    unit: '%',
    decimals: 2,
    value: (s) => s.bsw,
    sub: () => `Limit ≤ ${LIMITS.bsw}`,
    alert: (s) => s.bsw >= LIMITS.bsw,
  },
  {
    id: 'salt',
    label: 'Salt content',
    unit: 'mg/l',
    decimals: 0,
    value: (s) => s.salt,
    sub: () => `Limit ≤ ${LIMITS.salt}`,
    alert: (s) => s.salt >= LIMITS.salt,
  },
  {
    id: 'efficiency',
    label: 'Plant efficiency',
    unit: '%',
    decimals: 1,
    value: (s) => s.efficiency,
    sub: () => 'Normal',
  },
];

export const KPIS_WITHOUT_OIL = KPIS.filter((k) => k.id !== 'oil');
