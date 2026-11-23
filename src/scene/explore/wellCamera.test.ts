import { describe, expect, it } from 'vitest';
import { WELLS } from '../../data/field';
import { WORLD_WELLS, toWorld } from '../world';
import {
  CPF_KEEP_OUT,
  CPF_MESH_BOX,
  azimuthTowardOffset,
  facilityOccluders,
  occluderAwareView,
  pointInsideBoxXZ,
  segmentHitsBoxXZ,
  wellClearsCpfKeepOut,
  wellInspectView,
} from './wellCamera';

describe('wellCamera', () => {
  it('segmentHitsBoxXZ detects a ray through the CPF-1 box and misses one that stays north', () => {
    expect(segmentHitsBoxXZ(-20, 0, 20, 0, CPF_MESH_BOX)).toBe(true);
    expect(segmentHitsBoxXZ(0, -20, 0, 20, CPF_MESH_BOX)).toBe(true);
    // Entirely north of the north face (z = -6.35).
    expect(segmentHitsBoxXZ(0, -20, 0, -8, CPF_MESH_BOX)).toBe(false);
    // Parallel and west of the west face.
    expect(segmentHitsBoxXZ(-20, -20, -20, 20, CPF_MESH_BOX)).toBe(false);
  });

  it('places the inspect camera on the far side of a well from CPF-1', () => {
    // A well due north of the origin: camera should also be north (z more negative).
    const view = occluderAwareView([0, 1, -10], { dist: 6, elDeg: 28, fov: 34, occluders: facilityOccluders() });
    expect(view.position[2]).toBeLessThan(-10);
    expect(azimuthTowardOffset(0, -1)).toBeCloseTo(-90, 5);
  });

  it("RT-60's inspect ray does not pass through the CPF-1 box", () => {
    const w = WORLD_WELLS.find((well) => well.name === 'RT-60');
    expect(w).toBeTruthy();
    const center: [number, number, number] = [w!.world[0], 0.6, w!.world[1]];
    const view = wellInspectView(center);
    const hits = segmentHitsBoxXZ(view.position[0], view.position[2], view.target[0], view.target[2], CPF_MESH_BOX);
    expect(hits).toBe(false);
    // Camera sits on the far (north) side of the well, not looking through the plant.
    expect(view.position[2]).toBeLessThan(view.target[2]);
  });

  it('no ceremony well sits inside the CPF-1 keep-out', () => {
    for (const well of WELLS) {
      const world = toWorld([well.x, well.y]);
      expect(wellClearsCpfKeepOut(world), well.name).toBe(true);
      expect(pointInsideBoxXZ(world[0], world[1], CPF_KEEP_OUT), well.name).toBe(false);
    }
  });
});
