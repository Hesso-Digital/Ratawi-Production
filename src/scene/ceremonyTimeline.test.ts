import { describe, expect, it } from 'vitest';
import { PLAYBACK_MS } from '../config';
import { BASELINE, STEP_1, STEP_2, TARGET_KBOPD, TRAJECTORY } from '../data/defaults';
import { GAS_STEP2_MMSCFD } from '../data/ceremonyConfig';
import { BEATS, COUNTDOWN_DURATION_S } from '../data/scenario';
import type { Cue } from '../data/types';
import { cameraAt, sceneStateAt } from './ceremonyTimeline';

const cue = (kind: Cue['kind']): Cue => ({ kind, startedAt: 0 });
const step1 = (el: number) => sceneStateAt(cue('step1'), el, BASELINE, STEP_1);
const countdown = (el: number) => sceneStateAt(cue('countdown'), el, STEP_1, STEP_2);
const step2 = (el: number) => sceneStateAt(cue('step2'), el, STEP_1, STEP_2);
const playback = (el: number) => sceneStateAt(cue('playback'), el, STEP_2, STEP_2);
/** Elapsed seconds into the countdown cue at which scenario time T is reached. */
const countdownAtT = (T: number) => T - BEATS.step2Start + COUNTDOWN_DURATION_S;

describe('establishing shot', () => {
  it('shows 105 kbopd, 25 wells, no gas and nothing flowing from AGUP', () => {
    const s = sceneStateAt(cue('idle'), 3, BASELINE, BASELINE);
    expect(s.oil).toBe(105);
    expect(s.wells).toBe(25);
    expect(s.gas).toBe(0);
    expect(s.valves).toBe(0);
    expect(s.agupWave).toBe(0);
    expect(s.gold).toBe(0);
    expect(s.step).toBe(0);
  });
});

describe('Step 1: valves open, flow to CPF-1, 105 to 110', () => {
  it('opens the valves before the oil climbs', () => {
    expect(step1(0).valves).toBe(0);
    expect(step1(BEATS.valvesOpenEnd - BEATS.step1Start).valves).toBeCloseTo(1, 5);
    expect(step1(BEATS.valvesOpenEnd - BEATS.step1Start).oil).toBeCloseTo(105, 1);
  });
  it('lands on 110 kbopd with export 108 and no AGUP wells', () => {
    const s = step1(BEATS.step1Settled - BEATS.step1Start + 3);
    expect(s.oil).toBeCloseTo(110, 5);
    expect(s.exportKbopd).toBeCloseTo(108, 5);
    expect(s.wells).toBe(25);
    expect(s.agupIgnite).toBe(0);
    expect(s.gold).toBe(0);
    expect(s.step).toBe(1);
  });
  it('never decreases oil on the way', () => {
    let prev = 0;
    for (let el = 0; el <= 8; el += 0.1) {
      const { oil } = step1(el);
      expect(oil).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = oil;
    }
  });
});

describe('countdown', () => {
  it('counts 3, 2, 1 while holding the Step 1 values', () => {
    expect(countdown(0.1).countdown?.n).toBe(3);
    expect(countdown(1.0).countdown?.n).toBe(2);
    expect(countdown(1.9).countdown?.n).toBe(1);
    expect(countdown(1.9).oil).toBe(110);
    expect(countdown(1.9).wells).toBe(25);
    expect(countdown(1.9).valves).toBe(1);
    expect(countdown(1.9).agupIgnite).toBe(1);
  });
  it('runs on into Step 2 by itself and clears the ring', () => {
    expect(countdown(COUNTDOWN_DURATION_S + 0.5).countdown).toBeNull();
    expect(countdown(COUNTDOWN_DURATION_S + 0.5).agupIgnite).toBe(2);
    expect(countdown(COUNTDOWN_DURATION_S + 0.5).agupWave).toBeGreaterThan(0);
  });
  it('matches a plain Step 2 cue once the countdown has finished', () => {
    const a = countdown(COUNTDOWN_DURATION_S + 2.5);
    const b = step2(2.5);
    expect(a.oil).toBeCloseTo(b.oil, 9);
    expect(a.gas).toBeCloseTo(b.gas, 9);
    expect(a.wells).toBeCloseTo(b.wells, 9);
  });
});

describe('Step 2: AGUP + gas to the 120 milestone', () => {
  it('brings the 7 wells online in a wave, then the gas, then the oil', () => {
    const wave = step2(BEATS.agupWaveEnd - BEATS.step2Start);
    expect(wave.wells).toBeCloseTo(32, 5);
    const early = step2(0.4);
    expect(early.wells).toBeGreaterThan(25);
    expect(early.wells).toBeLessThan(32);
    expect(step2(BEATS.gasFlowStart - BEATS.step2Start - 0.01).gasFlow).toBeLessThan(0.01);
    expect(step2(BEATS.gasFlowEnd - BEATS.step2Start).gasFlow).toBeCloseTo(1, 5);
    expect(step2(BEATS.gasValueEnd - BEATS.step2Start).gas).toBeCloseTo(GAS_STEP2_MMSCFD, 5);
  });
  it('reaches 120 exactly at the milestone and goes gold only then', () => {
    const before = step2(BEATS.milestone - BEATS.step2Start - 0.3);
    expect(before.oil).toBeLessThan(TARGET_KBOPD);
    expect(before.gold).toBe(0);
    const at = step2(BEATS.milestone - BEATS.step2Start + 0.01);
    expect(at.oil).toBeCloseTo(TARGET_KBOPD, 1);
    expect(at.milestoneSince).toBeGreaterThanOrEqual(0);
    const settled = step2(BEATS.goldSettle - BEATS.step2Start + 1);
    expect(settled.gold).toBeCloseTo(1, 5);
    expect(settled.step).toBe(3);
    expect(settled.exportKbopd).toBeCloseTo(118, 5);
  });
  it('stays gold, with a camera that keeps moving, long after the sequence', () => {
    const s = step2(60);
    expect(s.gold).toBe(1);
    expect(s.oil).toBe(120);
    expect(s.camera.position.every(Number.isFinite)).toBe(true);
  });
});

describe('replay June to December', () => {
  it('starts at the June shutdown with nothing produced', () => {
    const s = playback(0);
    expect(s.oil).toBe(0);
    expect(s.wells).toBe(0);
    expect(s.gold).toBe(0);
    expect(s.playback?.progress).toBe(0);
  });
  it('passes through each month of the trajectory', () => {
    for (let i = 0; i <= 6; i++) {
      const s = playback(((i / 6) * PLAYBACK_MS) / 1000);
      expect(s.oil).toBeCloseTo(TRAJECTORY[i].oil, 5);
      expect(s.wells).toBeCloseTo(TRAJECTORY[i].wells, 5);
    }
  });
  it('ends on the same numbers the ceremony reached and goes gold', () => {
    const s = playback(PLAYBACK_MS / 1000 + 2);
    expect(s.playback?.done).toBe(true);
    expect(s.oil).toBe(STEP_2.oil);
    expect(s.wells).toBe(STEP_2.wells);
    expect(s.exportKbopd).toBe(STEP_2.exportKbopd);
    expect(s.gas).toBe(STEP_2.gas);
    expect(s.gold).toBe(1);
  });
});

describe('determinism', () => {
  it('is a pure function of its inputs, so a refreshed window resumes mid-sequence', () => {
    const a = step2(2.7);
    const b = step2(2.7);
    expect(a).toEqual(b);
  });
  it('keeps the camera continuous across the cue boundaries', () => {
    const gap = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    expect(gap(step1(BEATS.countdownStart - BEATS.step1Start).camera.position, countdown(0).camera.position)).toBeLessThan(4);
    expect(gap(countdown(COUNTDOWN_DURATION_S - 0.001).camera.position, step2(0).camera.position)).toBeLessThan(0.5);
  });
  it('hands the camera curve a finite value over the whole range', () => {
    for (let t = 0; t <= 30; t += 0.5) expect(cameraAt(t).position.every(Number.isFinite)).toBe(true);
  });
  it('lines up countdown timing helper with the scenario', () => {
    expect(countdownAtT(BEATS.step2Start)).toBeCloseTo(COUNTDOWN_DURATION_S, 9);
  });
});
