/**
 * Area-focus helpers: fly durations, flow-line dimming, and numbered marker
 * placements. Well beacon / beam visuals in Wells.tsx are deliberately left
 * alone; only gathering, gas and export tubes dim when an area is in focus.
 */
import { NORTH_WELL_NAMES, SOUTH_WELL_NAMES } from '../../data/field';
import { AG25_WORLD, AGUP_WELLS, CONCESSION_WORLD, CPF_WORLD, EXPORT_LINE_WORLD, SPP_WORLD, WORLD_WELLS, heightAt, type Vec2 } from '../world';
import { presetById } from './assets';

const NORTH = new Set<string>(NORTH_WELL_NAMES);
const SOUTH = new Set<string>(SOUTH_WELL_NAMES);

const DIM = 0.3;

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function flySecondsFor(kind: 'preset' | 'asset', id?: string): { duration: number; arc: boolean } {
  if (prefersReducedMotion()) return { duration: 0.3, arc: false };
  if (kind === 'preset') {
    const preset = id ? presetById(id) : undefined;
    return { duration: preset?.flySeconds ?? 1.5, arc: true };
  }
  return { duration: 1.5, arc: true };
}

/**
 * Brightness for a flow tube or its particles when an area is in focus.
 * `wellName` is the RT-* id for gathering / AGUP lines, undefined for gas/export.
 */
export function focusGain(areaId: string | null | undefined, kind: 'oil' | 'agup' | 'gas' | 'export', wellName?: string): number {
  if (!areaId || areaId === 'aerial') return 1;
  if (areaId === 'agup') return kind === 'agup' ? 1 : DIM;
  if (areaId === 'export') return kind === 'export' ? 1 : DIM;
  if (areaId === 'ag25') return kind === 'gas' ? 1 : DIM;
  if (areaId === 'cpf1') return kind === 'gas' ? DIM : 0.85;
  if (areaId === 'spp') return DIM;
  if (areaId === 'north') return wellName && NORTH.has(wellName) ? 1 : DIM;
  if (areaId === 'south') return wellName && SOUTH.has(wellName) ? 1 : DIM;
  return 1;
}

function ground(x: number, z: number, lift: number): [number, number, number] {
  return [x, heightAt(x, z) + lift, z];
}

function centroid(points: readonly Vec2[]): Vec2 {
  const sx = points.reduce((s, p) => s + p[0], 0);
  const sz = points.reduce((s, p) => s + p[1], 0);
  const n = points.length || 1;
  return [sx / n, sz / n];
}

function concessionCentroid(): Vec2 {
  return centroid(CONCESSION_WORLD);
}

const agupCentroid = centroid(AGUP_WELLS.map((w) => w.world));
const sppCentroid = centroid(SPP_WORLD);
const northCentroid = centroid(WORLD_WELLS.filter((w) => NORTH.has(w.name)).map((w) => w.world));
const southCentroid = centroid(WORLD_WELLS.filter((w) => SOUTH.has(w.name)).map((w) => w.world));
const exportMid = EXPORT_LINE_WORLD[Math.floor(EXPORT_LINE_WORLD.length / 2)];
const field = concessionCentroid();

export type AreaMarker = {
  id: string;
  key: string;
  label: string;
  position: [number, number, number];
};

/**
 * Zirku-style numbered markers. Lifted above the ground / facility meshes so
 * they stay readable from the whole-field camera. Hidden in show mode by the
 * component that mounts them.
 */
export const AREA_MARKERS: AreaMarker[] = [
  { id: 'aerial', key: '1', label: 'Whole field', position: ground(field[0], field[1] - 8, 14) },
  { id: 'cpf1', key: '2', label: 'CPF-1', position: ground(CPF_WORLD[0] - 2, CPF_WORLD[1] - 10, 10) },
  { id: 'ag25', key: '3', label: 'AG-25', position: ground(AG25_WORLD[0] - 8, AG25_WORLD[1], 8) },
  { id: 'agup', key: '4', label: 'AGUP wells', position: ground(agupCentroid[0] + 4, agupCentroid[1], 12) },
  { id: 'export', key: '5', label: 'Export', position: ground(exportMid[0], exportMid[1], 8) },
  { id: 'spp', key: '6', label: 'SPP', position: ground(sppCentroid[0], sppCentroid[1], 8) },
  { id: 'north', key: '7', label: 'North wells', position: ground(northCentroid[0], northCentroid[1], 9) },
  { id: 'south', key: '8', label: 'South wells', position: ground(southCentroid[0], southCentroid[1], 9) },
];
