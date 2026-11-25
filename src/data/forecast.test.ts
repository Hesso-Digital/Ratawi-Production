import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PRESETS,
  FORECAST_END_INDEX,
  FORECAST_HORIZON_MONTHS,
  FORECAST_START_INDEX,
  TODAY_INDEX,
  TRAJECTORY,
  linearNext,
} from './defaults';
import { snapshotAtMonth } from './series';
import { FORECAST_RGB, ribbonColor, ribbonColorAt } from '../scene/showpiece/layout';

describe('six month production forecast', () => {
  it('runs from December 2026 to May 2027 after the latest actual month', () => {
    expect(TRAJECTORY[TODAY_INDEX].key).toBe('2026-11');
    expect(FORECAST_HORIZON_MONTHS).toBe(6);
    expect(TRAJECTORY[FORECAST_START_INDEX].key).toBe('2026-12');
    expect(TRAJECTORY[FORECAST_END_INDEX].key).toBe('2027-05');
    expect(TRAJECTORY.slice(FORECAST_START_INDEX).every((m) => m.kind === 'forecast')).toBe(true);
    expect(TRAJECTORY.slice(0, FORECAST_START_INDEX).every((m) => m.kind === 'actual')).toBe(true);
  });

  it('extends the plan to May with a straight line through January to April', () => {
    expect(linearNext([123, 125, 127, 130])).toBe(132);
    const may = TRAJECTORY[FORECAST_END_INDEX];
    expect(may.oil).toBe(132);
    expect(may.exportKbopd).toBe(130);
    expect(may.wells).toBe(32);
  });

  it('follows the switch: holds at Current, or the plan when AGUP is online', () => {
    const held = snapshotAtMonth(FORECAST_END_INDEX, DEFAULT_PRESETS, false);
    expect(held.oil).toBe(DEFAULT_PRESETS.current.oil);
    const plan = snapshotAtMonth(FORECAST_END_INDEX, DEFAULT_PRESETS, true);
    expect(plan.oil).toBeCloseTo(132, 5);
  });

  it('colours the ribbon magenta only after the latest actual month', () => {
    expect(ribbonColorAt(TODAY_INDEX, 105, 90, 120, TODAY_INDEX)).toEqual(ribbonColor(105, 90, 120));
    expect(ribbonColorAt(TODAY_INDEX + 1, 120, 90, 120, TODAY_INDEX)).toEqual(FORECAST_RGB);
  });
});
