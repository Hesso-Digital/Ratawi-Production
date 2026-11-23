/**
 * Placement of the procedural well beacon and beam when the v2 wellhead GLBs
 * are on screen. The GLB's own `Beacon` node is skipped (WELL_SKIP in
 * FieldModels) because the instanced procedural beacon already carries the
 * per-well colour and cue animation. This module puts that beacon on the mast
 * instead of at the well centre, using the same yaw as WellSet.
 */

/** Local translation of the v2 wellhead / wellhead_agup GLB `Beacon` node (mast top). */
export const GLB_BEACON_LOCAL = { x: -0.45, y: 1.035, z: 0.38 } as const;

/** Same yaw as FieldModels WellSet: the flowline stub faces the parent / CPF-1. */
export function wellYaw(world: readonly [number, number], parentWorld: readonly [number, number]): number {
  return Math.atan2(-(parentWorld[1] - world[1]), parentWorld[0] - world[0]);
}

/** Rotate a local (x, z) offset around +Y, matching three.js `Object3D.rotation.y`. */
export function rotateYaw(x: number, z: number, yaw: number): [number, number] {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return [x * c + z * s, -x * s + z * c];
}

export function mastWorldPosition(
  world: readonly [number, number],
  parentWorld: readonly [number, number],
  groundY: number,
  local: { x: number; y: number; z: number } = GLB_BEACON_LOCAL,
): { x: number; y: number; z: number; yaw: number } {
  const yaw = wellYaw(world, parentWorld);
  const [dx, dz] = rotateYaw(local.x, local.z, yaw);
  return { x: world[0] + dx, y: groundY + local.y, z: world[1] + dz, yaw };
}

/** Beam opacity vs camera distance to the nearest mast (full far away, hidden when close). */
export function beamOpacityForDistance(distance: number, base = 0.28, near = 8, far = 28): number {
  const t = Math.min(1, Math.max(0, (distance - near) / Math.max(1e-6, far - near)));
  return base * t;
}

/** Pin marker size vs camera distance: small and elegant close up, still legible from the aerial view. */
export function pinScaleForDistance(d: number): number {
  return Math.min(2.3, Math.max(0.75, d / 52));
}
