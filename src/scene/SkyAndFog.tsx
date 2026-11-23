/**
 * Blue-hour sky dome + exponential fog, ported from design-3d/src/scene.js
 * `buildSky`. The sky gains a warm gold tint as the milestone grade rises.
 */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Color, type FogExp2, type Mesh, type ShaderMaterial } from 'three';
import { useThree } from '@react-three/fiber';
import { dayBlend } from '../state/sceneSettings';

const FOG_NIGHT = new Color('#0c1424');
const FOG_DAY = new Color('#e9e1d2');
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

  const scene = useThree((st) => st.scene);
  const gl = useThree((st) => st.gl);
  useFrame(() => {
    const day = dayBlend.value;
    const mat = meshRef.current?.material as ShaderMaterial | undefined;
    if (mat) {
      mat.uniforms.uGold.value = sceneClock.current.gold;
      mat.uniforms.uDay.value = day;
    }
    const fog = scene.fog as FogExp2 | null;
    if (fog) {
      fog.color.copy(FOG_NIGHT).lerp(FOG_DAY, day);
      // Desert haze: a little thinner than the night murk so the horizon swell reads.
      // Night: a thinner, darker murk so the ground stays deep (concepts 01-03). Day: light haze only.
      fog.density = 0.0042 - day * 0.0026;
    }
    gl.toneMappingExposure = 1.05 - day * 0.12;
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
