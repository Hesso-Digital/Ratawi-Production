/**
 * Blue-hour sky dome + exponential fog, ported from design-3d/src/scene.js
 * `buildSky`. The sky gains a warm gold tint as the milestone grade rises.
 */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { Mesh, ShaderMaterial } from 'three';
import { BackSide } from 'three';
import { createSkyMaterial } from './shaders/materials';
import { useSceneClockRef } from './useSceneClock';

export function SkyAndFog() {
  const sceneClock = useSceneClockRef();
  const meshRef = useRef<Mesh>(null);
  const material = useMemo(() => {
    const mat = createSkyMaterial();
    mat.side = BackSide;
    return mat;
  }, []);

  useFrame(() => {
    const mat = meshRef.current?.material as ShaderMaterial | undefined;
    if (mat) mat.uniforms.uGold.value = sceneClock.current.gold;
  });

  return (
    <>
      <fogExp2 attach="fog" args={['#142238', 0.0058]} />
      <mesh ref={meshRef} material={material} renderOrder={-10}>
        <sphereGeometry args={[900, 48, 24]} />
      </mesh>
    </>
  );
}
