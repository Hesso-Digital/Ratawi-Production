/**
 * Applies the keyframed drone camera from ceremonyTimeline.ts to the R3F
 * default camera every frame. `?debug=orbit` swaps in drei OrbitControls for
 * rehearsal/framing only (never shown to the audience).
 */
import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useMemo } from 'react';
import { Vector3 } from 'three';
import { useSceneClockRef } from './useSceneClock';
import type { CameraState } from './ceremonyTimeline';

const target = new Vector3();

export function CameraRig({
  debugOrbit,
  override,
}: {
  debugOrbit: boolean;
  /** A fixed framing for a specific frame preset (F5/F6 close-ups), bypassing the keyframed rig. */
  override?: CameraState;
}) {
  const sceneClock = useSceneClockRef();
  const { camera } = useThree();
  const initial = useMemo(() => sceneClock.current.camera, [sceneClock]);

  useFrame(() => {
    if (debugOrbit) return;
    const cam = override ?? sceneClock.current.camera;
    camera.position.set(...cam.position);
    target.set(...cam.target);
    camera.lookAt(target);
    if ('fov' in camera) {
      const persp = camera as unknown as { fov: number; updateProjectionMatrix: () => void };
      if (persp.fov !== cam.fov) {
        persp.fov = cam.fov;
        persp.updateProjectionMatrix();
      }
    }
  });

  if (debugOrbit) {
    return <OrbitControls target={initial.target} makeDefault />;
  }
  return null;
}
