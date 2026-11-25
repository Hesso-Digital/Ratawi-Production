import { describe, expect, it } from 'vitest';
import { WELLS } from '../data/field';
import { AG25_WORLD, AGUP_WELLS, CONCESSION_WORLD, CPF_WORLD, EXPORT_LINE_WORLD, heightAt, inPolygon, ONLINE_WELLS, SPP_WORLD, toWorld, WORLD_WELLS } from './world';

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

  it('keeps the concession elongated like the original map (N/E about 1.94)', () => {
    const xs = CONCESSION_WORLD.map((p) => p[0]);
    const zs = CONCESSION_WORLD.map((p) => p[1]);
    const east = Math.max(...xs) - Math.min(...xs);
    const north = Math.max(...zs) - Math.min(...zs);
    expect(north / east).toBeGreaterThan(1.85);
    expect(north / east).toBeLessThan(2.05);
  });

  it('keeps RT-10 at its previous grid (not labelled on the wells photo)', () => {
    const rt10 = WELLS.find((w) => w.name === 'RT-10');
    expect(rt10).toBeTruthy();
    expect(rt10!.x).toBe(4.5);
    expect(rt10!.y).toBe(3.6);
  });

  it('keeps every asset inside the Ratawi concession with room to spare', () => {
    const margin = 4; // world units (about 1 grid) from the red line
    const inside = ([x, z]: readonly [number, number]) =>
      inPolygon(x, z, CONCESSION_WORLD) && edgeDistance(x, z) >= margin;
    const edgeDistance = (x: number, z: number) => {
      let best = Infinity;
      for (let i = 0, j = CONCESSION_WORLD.length - 1; i < CONCESSION_WORLD.length; j = i++) {
        const [ax, az] = CONCESSION_WORLD[j];
        const [bx, bz] = CONCESSION_WORLD[i];
        const dx = bx - ax;
        const dz = bz - az;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
        best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
      }
      return best;
    };
    for (const w of WORLD_WELLS) expect(inside(w.world), w.name).toBe(true);
    expect(inside(CPF_WORLD)).toBe(true);
    expect(inside(AG25_WORLD)).toBe(true);
    for (const p of SPP_WORLD) expect(inside(p), `SPP ${p}`).toBe(true);
    for (const p of EXPORT_LINE_WORLD) expect(inside(p), `export ${p}`).toBe(true);
  });

  it('places RT-60 north of CPF-1, not east of it', () => {
    const w = WORLD_WELLS.find((well) => well.name === 'RT-60');
    expect(w).toBeTruthy();
    // +z is south, so north of origin is a negative z, and a modest positive x (slightly east).
    expect(w!.world[1]).toBeLessThan(-6);
    expect(w!.world[0]).toBeGreaterThan(0);
    expect(Math.abs(w!.world[0])).toBeLessThan(Math.abs(w!.world[1]));
  });
});
