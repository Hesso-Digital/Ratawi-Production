/**
 * Keep the designed 16:9 field framing when the viewport aspect changes.
 * Portrait and other tall frames pull the camera back (and add a little
 * vertical FOV) so the concession still fits. Wider-than-16:9 frames keep
 * the designed distance so the field does not shrink.
 */
export const DESIGN_ASPECT = 16 / 9;

export function framingForAspect(aspect: number): { pull: number; fovAdd: number } {
  if (!Number.isFinite(aspect) || aspect <= 0) return { pull: 1, fovAdd: 0 };
  if (aspect >= DESIGN_ASPECT) return { pull: 1, fovAdd: 0 };
  const raw = DESIGN_ASPECT / aspect;
  return {
    pull: Math.min(2.6, Math.sqrt(raw) * 1.08),
    fovAdd: Math.min(14, (raw - 1) * 5.5),
  };
}

export function fitCameraOffset(
  px: number,
  py: number,
  pz: number,
  tx: number,
  ty: number,
  tz: number,
  fov: number,
  aspect: number,
): { position: [number, number, number]; fov: number } {
  const { pull, fovAdd } = framingForAspect(aspect);
  return {
    position: [tx + (px - tx) * pull, ty + (py - ty) * pull, tz + (pz - tz) * pull],
    fov: fov + fovAdd,
  };
}
