import { describe, expect, it } from 'vitest';
import { beamOpacityForDistance, GLB_BEACON_LOCAL, mastWorldPosition, rotateYaw, wellYaw } from './wellMast';

describe('wellMast', () => {
  it('yaws the well so +X faces the parent (east parent => yaw 0)', () => {
    expect(wellYaw([0, 0], [4, 0])).toBeCloseTo(0, 6);
  });

  it('yaws the well so +X faces a parent to the south', () => {
    // parent is +Z (south in world.ts), atan2(-(+z), 0) = atan2(-1, 0) = -PI/2? 
    // atan2(-(1-0), (0-0)) = atan2(-1, 0) = -PI/2
    expect(wellYaw([0, 0], [0, 4])).toBeCloseTo(-Math.PI / 2, 6);
  });

  it('rotates the mast local offset with the well yaw, matching Object3D.rotation.y', () => {
    // yaw 0: offset is unchanged
    expect(rotateYaw(-0.45, 0.38, 0)[0]).toBeCloseTo(-0.45, 6);
    expect(rotateYaw(-0.45, 0.38, 0)[1]).toBeCloseTo(0.38, 6);
    // yaw 90° (PI/2): (x,z) -> (z, -x)
    const [x, z] = rotateYaw(-0.45, 0.38, Math.PI / 2);
    expect(x).toBeCloseTo(0.38, 6);
    expect(z).toBeCloseTo(0.45, 6);
  });

  it('places the mast at the rotated Beacon node, not at the well centre', () => {
    const groundY = 2;
    const at = mastWorldPosition([10, 20], [14, 20], groundY);
    expect(at.yaw).toBeCloseTo(0, 6);
    expect(at.x).toBeCloseTo(10 + GLB_BEACON_LOCAL.x, 5);
    expect(at.y).toBeCloseTo(groundY + GLB_BEACON_LOCAL.y, 5);
    expect(at.z).toBeCloseTo(20 + GLB_BEACON_LOCAL.z, 5);
    expect(at.x).not.toBeCloseTo(10, 2);
    expect(at.z).not.toBeCloseTo(20, 2);
  });

  it('fades the beam out as the camera gets close and keeps it at base opacity when far', () => {
    expect(beamOpacityForDistance(4, 0.28, 8, 28)).toBeCloseTo(0, 6);
    expect(beamOpacityForDistance(8, 0.28, 8, 28)).toBeCloseTo(0, 6);
    expect(beamOpacityForDistance(18, 0.28, 8, 28)).toBeCloseTo(0.14, 6);
    expect(beamOpacityForDistance(28, 0.28, 8, 28)).toBeCloseTo(0.28, 6);
    expect(beamOpacityForDistance(80, 0.28, 8, 28)).toBeCloseTo(0.28, 6);
  });
});
