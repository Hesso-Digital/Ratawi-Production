/**
 * Occluder-aware inspect cameras for wells that sit close to oversized
 * facility meshes (CPF-1, AG-25). The camera stands on the far side of the
 * well from the plant and walks around in 15° steps if the look-ray would
 * pass through a facility box.
 */
import { AG25_WORLD, CPF_WORLD, type Vec2 } from '../world';
import type { CameraState } from '../ceremonyTimeline';

export type V3 = [number, number, number];

export type BoxXZ = { cx: number; cz: number; hx: number; hz: number };

/** CPF-1 hit box from FACILITY_ASSETS, XZ half-extents. */
export const CPF_MESH_BOX: BoxXZ = { cx: 0, cz: 0, hx: 15.5 / 2, hz: 12.7 / 2 };

/** Mesh plus ~2 world units of clearance; wells on the surface count as clear. */
export const CPF_KEEP_OUT: BoxXZ = { cx: 0, cz: 0, hx: 15.5 / 2 + 2, hz: 12.7 / 2 + 2 };

export function facilityOccluders(): BoxXZ[] {
  return [
    { cx: CPF_WORLD[0], cz: CPF_WORLD[1], hx: 15.5 / 2, hz: 12.7 / 2 },
    { cx: AG25_WORLD[0], cz: AG25_WORLD[1], hx: 11.2 / 2, hz: 7.9 / 2 },
  ];
}

/** True when the point is strictly inside the box (surface is considered clear). */
export function pointInsideBoxXZ(x: number, z: number, box: BoxXZ, epsilon = 1e-3): boolean {
  return Math.abs(x - box.cx) < box.hx - epsilon && Math.abs(z - box.cz) < box.hz - epsilon;
}

export function wellClearsCpfKeepOut(world: Vec2): boolean {
  return !pointInsideBoxXZ(world[0], world[1], CPF_KEEP_OUT);
}

/**
 * Liang–Barsky in XZ. The segment is the look-ray from the camera to the
 * well; a hit means the plant would stand between the two.
 */
export function segmentHitsBoxXZ(ax: number, az: number, bx: number, bz: number, box: BoxXZ): boolean {
  const minX = box.cx - box.hx;
  const maxX = box.cx + box.hx;
  const minZ = box.cz - box.hz;
  const maxZ = box.cz + box.hz;
  let t0 = 0;
  let t1 = 1;
  const dx = bx - ax;
  const dz = bz - az;

  const clip = (p: number, q: number): boolean => {
    if (Math.abs(p) < 1e-12) return q >= 0;
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };

  if (!clip(-dx, ax - minX)) return false;
  if (!clip(dx, maxX - ax)) return false;
  if (!clip(-dz, az - minZ)) return false;
  if (!clip(dz, maxZ - az)) return false;
  return t1 >= t0;
}

/**
 * Azimuth in degrees for `frameFrom`: 0 looks from the west, 90 from the south.
 * The camera is placed in direction `(dx, dz)` from the target.
 */
export function azimuthTowardOffset(dx: number, dz: number): number {
  return (Math.atan2(dz, -dx) * 180) / Math.PI;
}

export function frameFrom(target: V3, dist: number, elDeg: number, azDeg: number, fov = 32): CameraState {
  const el = (elDeg * Math.PI) / 180;
  const az = (azDeg * Math.PI) / 180;
  return {
    position: [
      target[0] - Math.cos(az) * Math.cos(el) * dist,
      target[1] + Math.sin(el) * dist,
      target[2] + Math.sin(az) * Math.cos(el) * dist,
    ],
    target,
    fov,
  };
}

export function occluderAwareView(
  target: V3,
  opts?: { dist?: number; elDeg?: number; fov?: number; occluders?: BoxXZ[] },
): CameraState {
  const dist0 = opts?.dist ?? 6;
  const elDeg = opts?.elDeg ?? 28;
  const fov = opts?.fov ?? 34;
  const occluders = opts?.occluders ?? facilityOccluders();

  const awayX = target[0] - CPF_WORLD[0];
  const awayZ = target[2] - CPF_WORLD[1];
  const len = Math.hypot(awayX, awayZ) || 1;
  const baseAz = azimuthTowardOffset(awayX / len, awayZ / len);

  const hits = (pos: V3): boolean => occluders.some((box) => segmentHitsBoxXZ(pos[0], pos[2], target[0], target[2], box));

  const distances = [dist0, 7, 8, 10, 12];
  for (const dist of distances) {
    const candidates = [0];
    for (let step = 15; step <= 180; step += 15) {
      candidates.push(step, -step);
    }
    for (const delta of candidates) {
      const view = frameFrom(target, dist, elDeg, baseAz + delta, fov);
      if (!hits(view.position)) return view;
    }
  }

  return frameFrom(target, 12, elDeg, baseAz, fov);
}

/** Inspect framing for a well: close (5–7 units) and on the far side of the plant. */
export function wellInspectView(center: V3): CameraState {
  return occluderAwareView([center[0], center[1] + 0.6, center[2]], { dist: 6, elDeg: 28, fov: 34 });
}
