import { describe, expect, it } from 'vitest';
import { CONCESSION_WORLD, CPF_WORLD, METRES_PER_WORLD_UNIT, WORLD_WELLS, heightAt, outsideFieldBlend } from '../world';
import { demHeightM } from './dem';
import { DEM_CPF_M } from './demData';

describe('real terrain', () => {
  it('decodes the Copernicus grid with CPF-1 near 30 m above sea level', () => {
    expect(DEM_CPF_M).toBeGreaterThan(25);
    expect(DEM_CPF_M).toBeLessThan(38);
    expect(demHeightM(0, 0)).toBeCloseTo(DEM_CPF_M, 0);
  });

  it('keeps every well, CPF-1 and the concession essentially flat', () => {
    for (const w of WORLD_WELLS) expect(Math.abs(heightAt(w.world[0], w.world[1]))).toBeLessThan(0.3);
    expect(Math.abs(heightAt(CPF_WORLD[0], CPF_WORLD[1]))).toBeLessThan(0.3);
    for (const [x, z] of CONCESSION_WORLD) expect(outsideFieldBlend(x * 0.95, z * 0.95)).toBe(0);
  });

  it('follows the real trend outside: low marsh ground north, higher plain south-west', () => {
    const km = 1000 / METRES_PER_WORLD_UNIT;
    const north = heightAt(0, -30 * km);
    const southWest = heightAt(-40 * km, 45 * km);
    expect(north).toBeLessThan(-1);
    expect(southWest).toBeGreaterThan(3);
  });
});
