import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { STORAGE_KEY } from '../config';
import { BASELINE, STEP_1, STEP_2 } from './defaults';
import { useCeremonyStore } from './store';

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  localStorage.clear();
});

describe('useCeremonyStore', () => {
  it('starts with the idle cue and the baseline snapshot', () => {
    const { result } = renderHook(() => useCeremonyStore());
    expect(result.current.cue.kind).toBe('idle');
    expect(result.current.snapshot.oil).toBeCloseTo(BASELINE.oil, 5);
    expect(result.current.prevSnapshot).toEqual(result.current.snapshot);
  });

  it('a step cue freezes prevSnapshot at the old value and starts the new cue', () => {
    const { result } = renderHook(() => useCeremonyStore());
    act(() => {
      result.current.applySnapshot(STEP_1, 1, 'step1');
    });
    expect(result.current.cue.kind).toBe('step1');
    expect(result.current.step).toBe(1);
    expect(result.current.prevSnapshot.oil).toBeCloseTo(BASELINE.oil, 5);
    expect(result.current.snapshot.oil).toBeCloseTo(STEP_1.oil, 5);
  });

  it('a manual (idle) apply does not freeze a prevSnapshot ramp', () => {
    const { result } = renderHook(() => useCeremonyStore());
    act(() => {
      result.current.applySnapshot({ ...BASELINE, oil: 107 });
    });
    expect(result.current.cue.kind).toBe('idle');
    expect(result.current.prevSnapshot.oil).toBeCloseTo(107, 5);
    expect(result.current.snapshot.oil).toBeCloseTo(107, 5);
  });

  it('persists the cue so a refreshed/late-joining window resumes mid-sequence', () => {
    const { result, unmount } = renderHook(() => useCeremonyStore());
    act(() => {
      result.current.startCountdown();
    });
    const startedAt = result.current.cue.startedAt;
    unmount();

    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw as string);
    expect(parsed.cue.kind).toBe('countdown');
    expect(parsed.cue.startedAt).toBe(startedAt);

    // A brand new hook instance (simulating a page refresh) reads the same
    // cue back from storage instead of resetting to idle.
    const { result: resumed } = renderHook(() => useCeremonyStore());
    expect(resumed.current.cue.kind).toBe('countdown');
    expect(resumed.current.cue.startedAt).toBe(startedAt);
  });

  it('ignores malformed storage and falls back to the default state', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    const { result } = renderHook(() => useCeremonyStore());
    expect(result.current.cue.kind).toBe('idle');
    expect(result.current.snapshot.oil).toBeCloseTo(BASELINE.oil, 5);
  });

  it('reset returns to the idle cue, step 0 and the baseline snapshot', () => {
    const { result } = renderHook(() => useCeremonyStore());
    act(() => {
      result.current.applySnapshot(STEP_2, 2, 'step2');
    });
    act(() => {
      result.current.reset();
    });
    expect(result.current.cue.kind).toBe('idle');
    expect(result.current.step).toBe(0);
    expect(result.current.snapshot.oil).toBeCloseTo(BASELINE.oil, 5);
  });

  it('jumpToCue back-dates startedAt so elapsed time starts beyond zero', () => {
    const { result } = renderHook(() => useCeremonyStore());
    const before = Date.now();
    act(() => {
      result.current.jumpToCue('step2', 5);
    });
    expect(result.current.cue.kind).toBe('step2');
    expect(result.current.cue.startedAt).toBeLessThanOrEqual(before - 4999);
  });
});
