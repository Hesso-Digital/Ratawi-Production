import { describe, expect, it } from 'vitest';
import { WELLS } from '../data/field';
import { AGUP_WELLS, CONCESSION_WORLD, CPF_WORLD, heightAt, inPolygon, ONLINE_WELLS, toWorld, WORLD_WELLS } from './world';

describe('world.ts', () => {
  it('keeps the well counts from field.ts: 25 online + 7 AGUP = 32', () => {
    expect(WORLD_WELLS.length).toBe(32);
    expect(ONLINE_WELLS.length).toBe(25);
    expect(AGUP_WELLS.length).toBe(7);
  });

  it('keeps the exact AGUP well names field.ts lists', () => {
    const names = AGUP_WELLS.map((w) => w.name).sort();
    expect(names).toEqual(['RT-60', 'RT-63', 'RT-66', 'RT-68', 'RT-70', 'RT-71', 'RT-72'].sort());
  });

  it('keeps the concession vertex order and count from field.ts', () => {
    expect(CONCESSION_WORLD.length).toBe(8);
  });

  it('places CPF-1 at the world origin (it is the reference point)', () => {
    expect(CPF_WORLD[0]).toBeCloseTo(0, 5);
    expect(CPF_WORLD[1]).toBeCloseTo(0, 5);
  });

  it('toWorld is deterministic', () => {
    const a = toWorld([5, 5]);
    const b = toWorld([5, 5]);
    expect(a).toEqual(b);
  });

  it('heightAt is deterministic and finite everywhere near the field', () => {
    for (const w of WELLS) {
      const [x, z] = toWorld([w.x, w.y]);
      const h1 = heightAt(x, z);
      const h2 = heightAt(x, z);
      expect(h1).toBe(h2);
      expect(Number.isFinite(h1)).toBe(true);
    }
  });

  it('inPolygon correctly classifies a point inside vs. outside a simple square', () => {
    const square = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ] as const;
    expect(inPolygon(5, 5, square)).toBe(true);
    expect(inPolygon(50, 50, square)).toBe(false);
  });
});
