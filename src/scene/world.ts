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
import { demGreen, demHeightM, demWet } from './terrain/dem';
import { DEM_CPF_M } from './terrain/demData';

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

/**
 * Real-world metres per scene world unit, horizontally
 * (agup-refs/field-layout.json scene_scale.real_metres_per_world_unit).
 */
export const METRES_PER_WORLD_UNIT = 290.9;

/**
 * Vertical exaggeration applied to the real DEM relative to the horizontal
 * scene scale. The ground around Ratawi only varies ~0-170 m over 120 km
 * (about 1 m per km), which is invisible at true scale (35 m = 0.12 world
 * units). 60x turns the ~30 m fall to the northern marshes into ~6 units and
 * the south-western rise into a low horizon swell. Tune here only.
 */
export const TERRAIN_V_EXAGGERATION = 60;

/** Width, world units, of the blend from the flat field to the real DEM outside the concession. */
export const TERRAIN_BLEND_WIDTH = 14;

/** Distance from a point to the closest edge of a closed polygon. */
function distanceToPolygonEdge(x: number, z: number, poly: readonly Vec2[]): number {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, az] = poly[j];
    const [bx, bz] = poly[i];
    const dx = bx - ax;
    const dz = bz - az;
    const len2 = dx * dx + dz * dz || 1;
    const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / len2));
    const d = Math.hypot(x - (ax + dx * t), z - (az + dz * t));
    if (d < best) best = d;
  }
  return best;
}

/** 0 inside the concession, rising smoothly to 1 at TERRAIN_BLEND_WIDTH outside it. */
export function outsideFieldBlend(x: number, z: number): number {
  if (inPolygon(x, z, CONCESSION_WORLD)) return 0;
  const t = Math.min(1, distanceToPolygonEdge(x, z, CONCESSION_WORLD) / TERRAIN_BLEND_WIDTH);
  return t * t * (3 - 2 * t);
}

/** World (x east, z south) to metres east / north of CPF-1. */
export function worldToMetres(x: number, z: number): [number, number] {
  return [x * METRES_PER_WORLD_UNIT, -z * METRES_PER_WORLD_UNIT];
}

/** Real DEM relief relative to CPF-1, in exaggerated world units. */
export function demReliefAt(x: number, z: number): number {
  const [e, n] = worldToMetres(x, z);
  return ((demHeightM(e, n) - DEM_CPF_M) * TERRAIN_V_EXAGGERATION) / METRES_PER_WORLD_UNIT;
}

/** Ground cover shares from ESA WorldCover at a world point. */
export function groundCoverAt(x: number, z: number): { wet: number; green: number } {
  const [e, n] = worldToMetres(x, z);
  return { wet: demWet(e, n), green: demGreen(e, n) };
}

/**
 * Ground height. Inside the concession the field is kept essentially flat
 * (a few centimetres of compacted-ground noise) so every model seats on it.
 * Outside, it blends over TERRAIN_BLEND_WIDTH into the real Copernicus DEM
 * trend (see terrain/demData.ts) plus low gravel-desert ripples.
 */
export function heightAt(x: number, z: number): number {
  const flat = fbm(x * 0.05, z * 0.05, 3) * 0.25;
  const m = outsideFieldBlend(x, z);
  if (m <= 0) return flat;
  const ripples = fbm(x * 0.09 + 9, z * 0.09, 3) * 0.35;
  return flat + m * (demReliefAt(x, z) + ripples);
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
