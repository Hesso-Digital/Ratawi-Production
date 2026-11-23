import { describe, expect, it } from 'vitest';
import { BASELINE, STEP_1, STEP_2, TARGET_KBOPD } from '../data/defaults';
import { BEATS, cameraAt, sceneStateAt, sceneTimeFor } from './ceremonyTimeline';

describe('sceneTimeFor', () => {
  it('idle loops within 0–4.5s regardless of how long it has run', () => {
    expect(sceneTimeFor({ kind: 'idle', startedAt: 0 }, 0)).toBeCloseTo(0, 5);
    expect(sceneTimeFor({ kind: 'idle', startedAt: 0 }, 2)).toBeCloseTo(2, 5);
    expect(sceneTimeFor({ kind: 'idle', startedAt: 0 }, 4.5)).toBeCloseTo(0, 5);
    expect(sceneTimeFor({ kind: 'idle', startedAt: 0 }, 100)).toBeGreaterThanOrEqual(0);
    expect(sceneTimeFor({ kind: 'idle', startedAt: 0 }, 100)).toBeLessThan(4.5);
  });

  it('countdown maps elapsed time onto 4.9→ valves and then holds', () => {
    expect(sceneTimeFor({ kind: 'countdown', startedAt: 0 }, 0)).toBeCloseTo(BEATS.countdownStart, 5);
    expect(sceneTimeFor({ kind: 'countdown', startedAt: 0 }, 1)).toBeCloseTo(BEATS.countdownStart + 1, 5);
    // Held just before "valves" if Step 1 is never clicked.
    const held = sceneTimeFor({ kind: 'countdown', startedAt: 0 }, 50);
    expect(held).toBeLessThan(BEATS.valves);
    expect(held).toBeGreaterThan(BEATS.valves - 0.1);
  });

  it('step1 reaches 8.9 and then drifts without leaving the segment', () => {
    expect(sceneTimeFor({ kind: 'step1', startedAt: 0 }, 0)).toBeCloseTo(BEATS.valves, 5);
    expect(sceneTimeFor({ kind: 'step1', startedAt: 0 }, 1)).toBeCloseTo(BEATS.valves + 1, 5);
    const drifted = sceneTimeFor({ kind: 'step1', startedAt: 0 }, 30);
    expect(drifted).toBeGreaterThanOrEqual(BEATS.valves);
    expect(drifted).toBeLessThanOrEqual(BEATS.step2 + BEATS.step1DriftS);
  });

  it('step2 reaches 20 and then loops the final camera segment', () => {
    expect(sceneTimeFor({ kind: 'step2', startedAt: 0 }, 0)).toBeCloseTo(BEATS.step2, 5);
    expect(sceneTimeFor({ kind: 'step2', startedAt: 0 }, 11)).toBeCloseTo(BEATS.sequenceEnd, 5);
    const looped = sceneTimeFor({ kind: 'step2', startedAt: 0 }, 50);
    expect(looped).toBeGreaterThanOrEqual(BEATS.sequenceEnd - BEATS.orbitLoopS);
    expect(looped).toBeLessThanOrEqual(BEATS.sequenceEnd);
  });
});

describe('cameraAt', () => {
  it('matches the first and last keyframes at the segment edges', () => {
    const start = cameraAt(0);
    expect(start.position[0]).toBeCloseTo(-118, 1);
    expect(start.position[1]).toBeCloseTo(94, 1);
    const end = cameraAt(20);
    expect(end.position[0]).toBeCloseTo(-110, 1);
    expect(end.position[2]).toBeCloseTo(10, 1);
  });
});

describe('sceneStateAt — ceremony beats', () => {
  it('idle shows the current snapshot with no ramp', () => {
    const s = sceneStateAt({ kind: 'idle', startedAt: 0 }, 1, BASELINE, BASELINE);
    expect(s.oil).toBeCloseTo(105.0, 5);
    expect(s.wells).toBeCloseTo(25, 5);
    expect(s.gold).toBe(0);
  });

  it('step1 lerps from the baseline to 110 and settles there', () => {
    const early = sceneStateAt({ kind: 'step1', startedAt: 0 }, 0, BASELINE, STEP_1);
    expect(early.oil).toBeCloseTo(105.0, 1);
    const settled = sceneStateAt({ kind: 'step1', startedAt: 0 }, 5, BASELINE, STEP_1);
    expect(settled.oil).toBeCloseTo(110.0, 1);
    expect(settled.step).toBe(1);
  });

  it('step2 lerps wells 25→32, gas 0→target and oil to 120, then golds', () => {
    const early = sceneStateAt({ kind: 'step2', startedAt: 0 }, 0, STEP_1, STEP_2);
    expect(early.wells).toBeCloseTo(25, 1);
    expect(early.gold).toBe(0);

    const settled = sceneStateAt({ kind: 'step2', startedAt: 0 }, 11, STEP_1, STEP_2);
    expect(settled.oil).toBeCloseTo(120.0, 1);
    expect(settled.wells).toBeCloseTo(32, 1);
    expect(settled.gas).toBeCloseTo(STEP_2.gas, 1);
    expect(settled.gold).toBeCloseTo(1, 1);
    expect(settled.step).toBe(3);
  });

  it('gold is data-driven: never on below target, always on at/above target', () => {
    const belowTarget = sceneStateAt({ kind: 'idle', startedAt: 0 }, 1, BASELINE, { ...BASELINE, oil: TARGET_KBOPD - 0.5 });
    expect(belowTarget.gold).toBe(0);
    const atTarget = sceneStateAt({ kind: 'idle', startedAt: 0 }, 1, BASELINE, { ...BASELINE, oil: TARGET_KBOPD });
    expect(atTarget.gold).toBe(1);
    const aboveTarget = sceneStateAt({ kind: 'idle', startedAt: 0 }, 1, BASELINE, { ...BASELINE, oil: 130 });
    expect(aboveTarget.gold).toBe(1);
  });

  it('oil climbs monotonically through the step2 ramp (no overshoot/flicker)', () => {
    const samples = Array.from({ length: 40 }, (_, i) => sceneStateAt({ kind: 'step2', startedAt: 0 }, i * 0.3, STEP_1, STEP_2).oil);
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeGreaterThanOrEqual(samples[i - 1] - 1e-9);
    }
  });

  it('countdown holds the pre-valves snapshot and counts 3,2,1', () => {
    const s0 = sceneStateAt({ kind: 'countdown', startedAt: 0 }, 0.1, BASELINE, STEP_1);
    expect(s0.oil).toBeCloseTo(105.0, 5);
    expect(s0.countdown?.n).toBe(3);
    const s1 = sceneStateAt({ kind: 'countdown', startedAt: 0 }, 1.6, BASELINE, STEP_1);
    expect(s1.countdown?.n).toBe(1);
  });
});
