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

  it('Step 1 animates from the baseline to 110 kbopd', () => {
    const { result } = renderHook(() => useCeremonyStore());
    act(() => result.current.runStep1());
    expect(result.current.cue.kind).toBe('step1');
    expect(result.current.step).toBe(1);
    expect(result.current.prevSnapshot.oil).toBe(BASELINE.oil);
    expect(result.current.snapshot.oil).toBe(STEP_1.oil);
  });

  it('the countdown carries the Step 2 target so it can run on into Step 2', () => {
    const { result } = renderHook(() => useCeremonyStore());
    act(() => result.current.runStep1());
    act(() => result.current.runCountdown());
    expect(result.current.cue.kind).toBe('countdown');
    expect(result.current.prevSnapshot.oil).toBe(STEP_1.oil);
    expect(result.current.snapshot.oil).toBe(STEP_2.oil);
    expect(result.current.snapshot.gas).toBe(STEP_2.gas);
  });

  it('a manual apply jumps straight to the typed values', () => {
    const { result } = renderHook(() => useCeremonyStore());
    act(() => result.current.applySnapshot({ ...BASELINE, oil: 107 }));
    expect(result.current.cue.kind).toBe('idle');
    expect(result.current.prevSnapshot.oil).toBe(107);
    expect(result.current.snapshot.oil).toBe(107);
  });

  it('persists the cue so a refreshed or late-joining window resumes mid-sequence', () => {
    const { result, unmount } = renderHook(() => useCeremonyStore());
    act(() => result.current.runCountdown());
    const startedAt = result.current.cue.startedAt;
    unmount();

    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) as string);
    expect(parsed.cue.kind).toBe('countdown');
    expect(parsed.cue.startedAt).toBe(startedAt);

    const { result: resumed } = renderHook(() => useCeremonyStore());
    expect(resumed.current.cue.kind).toBe('countdown');
    expect(resumed.current.cue.startedAt).toBe(startedAt);
    expect(resumed.current.snapshot.oil).toBe(STEP_2.oil);
  });

  it('ignores malformed storage and falls back to the default state', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    const { result } = renderHook(() => useCeremonyStore());
    expect(result.current.cue.kind).toBe('idle');
    expect(result.current.snapshot.oil).toBe(BASELINE.oil);
  });

  it('reset returns to the establishing shot and keeps the chosen view and quality', () => {
    const { result } = renderHook(() => useCeremonyStore());
    act(() => result.current.setQuality('high'));
    act(() => result.current.runStep2());
    act(() => result.current.reset());
    expect(result.current.cue.kind).toBe('idle');
    expect(result.current.step).toBe(0);
    expect(result.current.snapshot.oil).toBe(BASELINE.oil);
    expect(result.current.quality).toBe('high');
  });

  it('jumpToCue back-dates startedAt and loads the values that beat expects', () => {
    const { result } = renderHook(() => useCeremonyStore());
    const before = Date.now();
    act(() => result.current.jumpToCue('step2', 5));
    expect(result.current.cue.kind).toBe('step2');
    expect(result.current.cue.startedAt).toBeLessThanOrEqual(before - 4999);
    expect(result.current.prevSnapshot.oil).toBe(STEP_1.oil);
    expect(result.current.snapshot.oil).toBe(STEP_2.oil);
  });

  it('the replay is a cue, so every window shares its clock', () => {
    const { result } = renderHook(() => useCeremonyStore());
    act(() => result.current.playStory());
    expect(result.current.cue.kind).toBe('playback');
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) as string);
    expect(stored.cue.kind).toBe('playback');
  });
});
