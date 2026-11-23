import { describe, expect, it } from 'vitest';
import { DESIGN_ASPECT, fitCameraOffset, framingForAspect } from './viewportFit';

describe('framingForAspect', () => {
  it('leaves 16:9 and wider frames at the designed distance', () => {
    expect(framingForAspect(DESIGN_ASPECT)).toEqual({ pull: 1, fovAdd: 0 });
    expect(framingForAspect(32 / 9).pull).toBe(1);
  });

  it('pulls the camera back in portrait so the field still fits', () => {
    const phone = framingForAspect(390 / 844);
    expect(phone.pull).toBeGreaterThan(1.6);
    expect(phone.pull).toBeLessThanOrEqual(2.6);
    expect(phone.fovAdd).toBeGreaterThan(6);
  });
});

describe('fitCameraOffset', () => {
  it('moves the camera away from the target in portrait and keeps the target', () => {
    const fitted = fitCameraOffset(-110, 90, 40, 0, 0, -6, 30, 390 / 844);
    const orig = Math.hypot(-110 - 0, 90 - 0, 40 - -6);
    const next = Math.hypot(fitted.position[0] - 0, fitted.position[1] - 0, fitted.position[2] - -6);
    expect(next).toBeGreaterThan(orig * 1.5);
    expect(fitted.fov).toBeGreaterThan(30);
  });
});
