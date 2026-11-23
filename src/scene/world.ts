/**
 * Converts src/data/field.ts grid coordinates (the real traced concession) into
 * three.js world units: x = east, z = south, y = up. Also ports the terrain
 * height function from the approved design-3d prototype (design-3d/src/scene.js
 * heightAt), recalibrated to this field's extent.
 *
 * The concession vertices are the 8-vertex chamfered outline traced from the
 * official red-line photograph (aspect N/E ≈ 1.72). An official KML/SHP, if
 * it arrives, is swapped in field.ts; nothing else in this file needs to change.
 * See ceremonyConfig.ts OPEN_QUESTIONS.concessionShape / officialVector.
 */
import {
  AG25,
  CONCESSION,
  CPF,
  EXPORT_LINE,
  parentOf,
  SPP,
  WELLS,
  type Grid,
  type Well,
} from '../data/field';

/** 1 grid unit ≈ 3.9 world units, so the ~20-unit-tall concession reads as ~78u. */
export const WORLD_SCALE = 3.9;

export type Vec2 = readonly [number, number];

export function toWorld([gx, gy]: Grid): Vec2 {
  return [(gx - CPF[0]) * WORLD_SCALE, (gy - CPF[1]) * WORLD_SCALE];
}

export function toWorldList(points: readonly Grid[]): Vec2[] {
  return points.map(toWorld);
}

export const CPF_WORLD = toWorld(CPF);
export const AG25_WORLD = toWorld(AG25);
export const CONCESSION_WORLD = toWorldList(CONCESSION);
export const SPP_WORLD = toWorldList(SPP);
export const EXPORT_LINE_WORLD = toWorldList(EXPORT_LINE);

export type WorldWell = Well & { world: Vec2; parentWorld: Vec2 };

function buildWorldWells(): WorldWell[] {
  return WELLS.map((w) => ({
    ...w,
    world: toWorld([w.x, w.y]),
    parentWorld: toWorld(parentOf(w, WELLS)),
  }));
}

export const WORLD_WELLS = buildWorldWells();
export const AGUP_WELLS = WORLD_WELLS.filter((w) => w.kind === 'agup');
export const ONLINE_WELLS = WORLD_WELLS.filter((w) => w.kind === 'online');

// ---------------------------------------------------------------------------
// Terrain height field, ported from design-3d/src/scene.js (mulberry32 noise +
// a simple value-noise fbm). Kept pure/deterministic so world.ts stays testable
// without a renderer.
// ---------------------------------------------------------------------------

function mulberry32(seed: number) {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeNoise(seed: number) {
  const r = mulberry32(seed);
  const perm = new Uint8Array(512);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const grad = (h: number, x: number, y: number) => {
    const a = ((h & 7) * Math.PI) / 4;
    return Math.cos(a) * x + Math.sin(a) * y;
  };
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  return (x: number, y: number) => {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = fade(xf);
    const v = fade(yf);
    const a = perm[X] + Y;
    const b = perm[X + 1] + Y;
    const lerp = (lo: number, hi: number, t: number) => lo + t * (hi - lo);
    return lerp(
      lerp(grad(perm[a], xf, yf), grad(perm[b], xf - 1, yf), u),
      lerp(grad(perm[a + 1], xf, yf - 1), grad(perm[b + 1], xf - 1, yf - 1), u),
      v,
    );
  };
}

const noise = makeNoise(7);

function fbm(x: number, y: number, octaves = 5) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise(x * freq, y * freq);
    freq *= 2.03;
    amp *= 0.5;
  }
  return sum;
}

/** Field half-extents in world units, used to fade dunes in near the facilities. */
const FIELD_HALF_X = 22;
const FIELD_HALF_Z = 42;

export function heightAt(x: number, z: number): number {
  const fieldMask = Math.min(1, Math.max(0, (Math.hypot(x / FIELD_HALF_X, (z - 2) / FIELD_HALF_Z) - 1) / 1.2));
  const m = fieldMask * fieldMask * (3 - 2 * fieldMask);
  const w = fbm(x * 0.02, z * 0.02, 3) * 18;
  const ridge = 1 - Math.abs(Math.sin((x * 0.55 + z * 0.84) * 0.09 + w * 0.25));
  const dunes = Math.pow(ridge, 2.2) * 6.5 + fbm(x * 0.03 + 9, z * 0.03, 4) * 5;
  const gentle = fbm(x * 0.05, z * 0.05, 3) * 0.55;
  return gentle + m * dunes;
}

export function heightAtGrid(gx: number, gy: number): number {
  const [x, z] = toWorld([gx, gy]);
  return heightAt(x, z);
}

/** Even-odd point-in-polygon test, world-space (x, z). */
export function inPolygon(x: number, z: number, poly: readonly Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Densifies an open polyline into terrain-following points, ported from
 * design-3d/src/scene.js `pathFromXZ` (non-sharp branch). Used to build
 * flowline/pipe curves that hug the dune heightfield instead of clipping
 * through it.
 */
export function pathPoints(points: readonly Vec2[], lift: number): Array<[number, number, number]> {
  const out: Array<[number, number, number]> = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, az] = points[i];
    const [bx, bz] = points[i + 1];
    const dist = Math.hypot(bx - ax, bz - az);
    const n = Math.max(2, Math.ceil(dist / 2.2));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const x = ax + (bx - ax) * t;
      const z = az + (bz - az) * t;
      out.push([x, heightAt(x, z) + lift, z]);
    }
  }
  const [lx, lz] = points[points.length - 1];
  out.push([lx, heightAt(lx, lz) + lift, lz]);
  return out;
}

/** Axis-aligned bounding box of a polygon, world units. */
export function polygonBounds(poly: readonly Vec2[]) {
  const xs = poly.map((p) => p[0]);
  const zs = poly.map((p) => p[1]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
}
