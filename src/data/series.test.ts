import { describe, expect, it } from 'vitest';
import { KPI_SERIES, MONTHS, OIL_STEPS, valueAt } from './series';
import { BASELINE, STEP_2, TRAJECTORY } from './defaults';
import { MONTHLY_QUALITY } from './ceremonyConfig';

describe('chart series come straight from the scenario data', () => {
  it('covers June to December', () => {
    expect(MONTHS.map((m) => m.label)).toEqual(['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']);
  });
  it('uses TRAJECTORY and MONTHLY_QUALITY values unchanged', () => {
    expect(KPI_SERIES.oil.values).toEqual(TRAJECTORY.slice(0, 7).map((m) => m.oil));
    expect(KPI_SERIES.gas.values).toEqual(TRAJECTORY.slice(0, 7).map((m) => m.gas));
    expect(KPI_SERIES.salt.values).toEqual(MONTHLY_QUALITY.map((q) => q.salt));
    expect(KPI_SERIES.oil.values[5]).toBe(BASELINE.oil);
    expect(KPI_SERIES.oil.values[6]).toBe(STEP_2.oil);
  });
  it('builds 105 to 120 in the ceremony steps', () => {
    expect(OIL_STEPS.map((s) => s.value)).toEqual([105, 110, 120]);
  });
  it('interpolates for the scrubber', () => {
    expect(valueAt([0, 10], 0.5)).toBe(5);
    expect(valueAt([0, 10], 9)).toBe(10);
  });
});
