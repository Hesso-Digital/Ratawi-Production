import { describe, expect, it } from 'vitest';
import { markerStyleForDistance, tagStyleForDistance } from './tagStyle';
import { pinScaleForDistance } from '../wellMast';

describe('in-scene label sizing', () => {
  it('never grows tags past their CSS size and shrinks them far away', () => {
    expect(tagStyleForDistance(10, true).scale).toBe(1);
    expect(tagStyleForDistance(400, true).scale).toBeCloseTo(0.6);
  });
  it('keeps plant tags readable but fades secondary tags with distance', () => {
    expect(tagStyleForDistance(300, true).opacity).toBeGreaterThanOrEqual(0.6);
    expect(tagStyleForDistance(60, false).opacity).toBe(1);
    expect(tagStyleForDistance(200, false).opacity).toBe(0);
  });
  it('clamps area markers and pins', () => {
    expect(markerStyleForDistance(20).scale).toBe(1);
    expect(pinScaleForDistance(5)).toBe(0.7);
    expect(pinScaleForDistance(1000)).toBe(1.7);
  });
});
