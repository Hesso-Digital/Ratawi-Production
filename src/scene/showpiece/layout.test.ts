import { describe, expect, it } from 'vitest';
import { PLAYBACK_END_INDEX, TRAJECTORY } from '../../data/defaults';
import { CONCESSION_WORLD } from '../world';
import {
  EXPLODED_CAMERA,
  FIELD_CENTER,
  LAYERS,
  RIBBON,
  RIBBON_CAMERA,
  layerLift,
  ribbonColor,
  ribbonMilestones,
  ribbonY,
  ribbonZ,
  sampleSeries,
  scalePolygon,
} from './layout';

describe('exploded layout', () => {
  it('stacks reservoir < network < surface < prism top', () => {
    const resTop = LAYERS.reservoir.y + LAYERS.reservoir.thickness;
    expect(resTop).toBeLessThan(LAYERS.network.lift);
    expect(LAYERS.network.lift).toBeLessThan(LAYERS.surface.lift);
    expect(LAYERS.surface.lift).toBeLessThan(LAYERS.prismTop);
  });

  it('lifts nothing when closed and the full amount when open', () => {
    expect(layerLift('surface', 0)).toBe(0);
    expect(layerLift('network', 1)).toBe(LAYERS.network.lift);
    expect(layerLift('surface', 2)).toBe(LAYERS.surface.lift);
  });

  it('scales the concession about its centre', () => {
    const big = scalePolygon(CONCESSION_WORLD, 1.1);
    expect(big).toHaveLength(CONCESSION_WORLD.length);
    const d0 = Math.hypot(CONCESSION_WORLD[0][0] - FIELD_CENTER[0], CONCESSION_WORLD[0][1] - FIELD_CENTER[1]);
    const d1 = Math.hypot(big[0][0] - FIELD_CENTER[0], big[0][1] - FIELD_CENTER[1]);
    expect(d1 / d0).toBeCloseTo(1.1, 5);
  });

  it('keeps both framings inside the orbit distance limit', () => {
    for (const c of [EXPLODED_CAMERA, RIBBON_CAMERA]) {
      const d = Math.hypot(...c.position.map((p, i) => p - c.target[i]));
      expect(d).toBeLessThan(240);
    }
  });
});

describe('production ribbon', () => {
  const oil = TRAJECTORY.map((m) => m.oil);

  it('samples pass through every month value and never undershoot zero', () => {
    const s = sampleSeries(oil, 8);
    expect(s[0]).toEqual({ i: 0, v: oil[0] });
    expect(s[s.length - 1]).toEqual({ i: oil.length - 1, v: oil[oil.length - 1] });
    for (let m = 0; m < oil.length; m++) {
      const hit = s.find((p) => Math.abs(p.i - m) < 1e-9);
      expect(hit?.v).toBeCloseTo(oil[m], 6);
    }
    expect(Math.min(...s.map((p) => p.v))).toBeGreaterThanOrEqual(0);
  });

  it('reads milestones from the series: start, recorded peak, AGUP month, last month', () => {
    const ms = ribbonMilestones(TRAJECTORY, oil, PLAYBACK_END_INDEX);
    expect(ms.map((m) => m.month)).toEqual(['Jun', 'Oct', 'Dec', 'Apr']);
    expect(ms.map((m) => m.value)).toEqual([oil[0], 108, oil[PLAYBACK_END_INDEX], oil[oil.length - 1]]);
  });

  it('runs months south to north and rises with value', () => {
    expect(ribbonZ(0, 11)).toBe(RIBBON.zStart);
    expect(ribbonZ(10, 11)).toBe(RIBBON.zEnd);
    expect(ribbonY(120)).toBeGreaterThan(ribbonY(90));
  });

  it('shades cyan at the bottom and gold at the top', () => {
    const lo = ribbonColor(0, 130);
    const hi = ribbonColor(130, 130);
    expect(lo[2]).toBeGreaterThan(lo[0]);
    expect(hi[0]).toBeGreaterThan(hi[2]);
  });
});
