/**
 * Bilinear lookups into the real DEM / land-cover grid in demData.ts.
 * Coordinates are metres east / north of CPF-1. Outside the grid the edge
 * value is held. Pure and deterministic, so world.ts stays testable.
 */
import { DEM_HALF_M, DEM_N, DEM_SPACING_M, GREEN_B64, HEIGHT_DM_B64, WET_B64 } from './demData';

function decodeBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function decodeHeights(): Float32Array {
  const bytes = decodeBytes(HEIGHT_DM_B64);
  const view = new DataView(bytes.buffer);
  const out = new Float32Array(DEM_N * DEM_N);
  for (let i = 0; i < out.length; i++) out[i] = view.getInt16(i * 2, true) / 10;
  return out;
}

function decodeShare(b64: string): Float32Array {
  const bytes = decodeBytes(b64);
  const out = new Float32Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) out[i] = bytes[i] / 255;
  return out;
}

const HEIGHT_M = decodeHeights();
const WET = decodeShare(WET_B64);
const GREEN = decodeShare(GREEN_B64);

function bilinear(grid: Float32Array, eastM: number, northM: number): number {
  const max = DEM_N - 1;
  const c = Math.min(max, Math.max(0, (eastM + DEM_HALF_M) / DEM_SPACING_M));
  const r = Math.min(max, Math.max(0, (DEM_HALF_M - northM) / DEM_SPACING_M));
  const c0 = Math.min(max - 1, Math.floor(c));
  const r0 = Math.min(max - 1, Math.floor(r));
  const fc = c - c0;
  const fr = r - r0;
  const i = r0 * DEM_N + c0;
  const top = grid[i] + (grid[i + 1] - grid[i]) * fc;
  const bottom = grid[i + DEM_N] + (grid[i + DEM_N + 1] - grid[i + DEM_N]) * fc;
  return top + (bottom - top) * fr;
}

/** Ground elevation above sea level, metres (Copernicus GLO-30, smoothed). */
export function demHeightM(eastM: number, northM: number): number {
  return bilinear(HEIGHT_M, eastM, northM);
}

/** Share of open water / herbaceous wetland, 0-1 (ESA WorldCover 2021). */
export function demWet(eastM: number, northM: number): number {
  return bilinear(WET, eastM, northM);
}

/** Share of cropland / grass / shrub / trees, 0-1 (ESA WorldCover 2021). */
export function demGreen(eastM: number, northM: number): number {
  return bilinear(GREEN, eastM, northM);
}
