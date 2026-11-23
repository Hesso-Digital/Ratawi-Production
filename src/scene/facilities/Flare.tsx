/**
 * A flare stack: a thin mast with a glowing cone flame, ported from
 * design-3d/src/scene.js `flare`. `getIntensity` reads the scene clock each
 * frame (CPF-1's flare is always lit; AG-25's stays dark until gas flows).
 */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { ConeGeometry, Group, Mesh, MeshBasicMaterial, PointLight } from 'three';
import { hdr } from '../shaders/materials';
import { useSceneClockRef } from '../useSceneClock';
import type { SceneState } from '../ceremonyTimeline';
import { FACILITY_MATERIALS } from './materials';
import { sceneSettings } from '../../state/sceneSettings';

export function Flare({
  position,
  height,
  scale = 1,
  getIntensity,
}: {
  position: [number, number, number];
  height: number;
  scale?: number;
  getIntensity?: (s: SceneState) => number;
}) {
  const sceneClock = useSceneClockRef();
  const groupRef = useRef<Group>(null);
  const coreFlame = useRef<Mesh>(null);
  const tipFlame = useRef<Mesh>(null);
  const lightRef = useRef<PointLight>(null);

  const { coreMat, tipMat, coreGeo, tipGeo } = useMemo(
    () => ({
      coreMat: new MeshBasicMaterial({ color: hdr('#ff7a1a', 4), toneMapped: false, transparent: true, opacity: 0.9 }),
      tipMat: new MeshBasicMaterial({ color: hdr('#ffe2a0', 6), toneMapped: false, transparent: true, opacity: 0.9 }),
      coreGeo: new ConeGeometry(0.28 * scale, 1.3 * scale, 16, 1, true),
      tipGeo: new ConeGeometry(0.12 * scale, 0.7 * scale, 12, 1, true),
    }),
    [scale],
  );

  useFrame(({ clock }) => {
    const intensity = getIntensity ? getIntensity(sceneClock.current) : 1;
    const flicker = sceneSettings.get().flows ? 1 + 0.08 * Math.sin(clock.elapsedTime * 9) : 1;
    if (groupRef.current) groupRef.current.visible = intensity > 0.02;
    if (coreFlame.current) coreFlame.current.scale.setScalar(flicker * (0.6 + 0.4 * intensity));
    if (tipFlame.current) tipFlame.current.scale.setScalar(flicker * (0.6 + 0.4 * intensity));
    if (lightRef.current) lightRef.current.intensity = 6 * scale * intensity;
  });

  return (
    <group position={position}>
      <mesh position={[0, height / 2, 0]} material={FACILITY_MATERIALS.steelDark} castShadow>
        <cylinderGeometry args={[0.07, 0.07, height, 10]} />
      </mesh>
      <group ref={groupRef} position={[0, height, 0]}>
        <mesh ref={coreFlame} position={[0, 0.6 * scale, 0]} geometry={coreGeo} material={coreMat} />
        <mesh ref={tipFlame} position={[0, 0.35 * scale, 0]} geometry={tipGeo} material={tipMat} />
        <pointLight ref={lightRef} color="#ff8a3a" distance={14 * scale} decay={1.6} position={[0, 0.4, 0]} />
      </group>
    </group>
  );
}
