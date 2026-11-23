import { describe, expect, it } from 'vitest';
import { DEFAULT_PRESETS } from './defaults';
import { snapshotAtMonth } from './series';
import { presetsAreValid, validateField, validatePresets } from './presets';

describe('preset validation', () => {
  it('accepts the default Current and AGUP online values', () => {
    expect(presetsAreValid(validatePresets(DEFAULT_PRESETS))).toBe(true);
  });

  it('rejects a non-numeric or out-of-range value', () => {
    expect(validateField('abc', 0, 100, false).error).toBeTruthy();
    expect(validateField(-1, 0, 100, false).error).toBeTruthy();
    expect(validateField(12.5, 0, 100, true).error).toBeTruthy();
    expect(validateField(32, 0, 64, true).value).toBe(32);
  });
});

describe('snapshotAtMonth', () => {
  it('keeps November actuals even when AGUP is online', () => {
    const snap = snapshotAtMonth(5, DEFAULT_PRESETS, true);
    expect(snap.oil).toBeCloseTo(105);
    expect(snap.wells).toBeCloseTo(25);
  });

  it('holds future actuals at Current when AGUP is not online', () => {
    const snap = snapshotAtMonth(6, DEFAULT_PRESETS, false);
    expect(snap.oil).toBeCloseTo(DEFAULT_PRESETS.current.oil);
    expect(snap.wells).toBeCloseTo(DEFAULT_PRESETS.current.wells);
  });

  it('uses the AGUP online forecast for December when AGUP is online', () => {
    const snap = snapshotAtMonth(6, DEFAULT_PRESETS, true);
    expect(snap.oil).toBeCloseTo(DEFAULT_PRESETS.agup.oil);
    expect(snap.wells).toBeCloseTo(DEFAULT_PRESETS.agup.wells);
  });
});
