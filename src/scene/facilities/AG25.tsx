/**
 * AG-25, the gas plant beside CPF-1: simplified from design-3d/src/scene.js
 * `buildAG25`. Stays dark (standby) until gas flows from CPF-1, then its
 * windows, sphere lights and flare come alive — driven every frame by the
 * scene clock's `gasFlow`, the same number FlowLines.tsx uses for the pipe.
 */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Color, Mesh, MeshBasicMaterial } from 'three';
import { AG25_WORLD, heightAt } from '../world';
import { hdr } from '../shaders/materials';
import { useSceneClockRef } from '../useSceneClock';
import { FACILITY_MATERIALS as M } from './materials';
import { Flare } from './Flare';

const WARM_BASE = new Color('#ffc98a');
const WHITE_BASE = new Color('#e8f4ff');

function GasLight({
  position,
  base,
  meshRef,
}: {
  position: [number, number, number];
  base: Color;
  meshRef: (m: Mesh | null) => void;
}) {
  const material = useMemo(() => new MeshBasicMaterial({ color: hdr(base, 0.5), toneMapped: false }), [base]);
  const ref = (m: Mesh | null) => {
    if (m) m.userData.base = base;
    meshRef(m);
  };
  return (
    <mesh ref={ref} position={position} material={material}>
      <sphereGeometry args={[0.045, 8, 6]} />
    </mesh>
  );
}

export function AG25() {
  const sceneClock = useSceneClockRef();
  const [ax, az] = AG25_WORLD;
  const y = heightAt(ax, az) + 0.02;
  const lightMeshes = useRef<Mesh[]>([]);

  useFrame(() => {
    const live = Math.min(1, Math.max(0, sceneClock.current.gasFlow * 1.2));
    for (const mesh of lightMeshes.current) {
      if (!mesh) continue;
      const mat = mesh.material as MeshBasicMaterial;
      const base = mesh.userData.base as Color;
      mat.color.copy(base).multiplyScalar(0.5 + 2.6 * live);
    }
  });

  const pushRef = (i: number) => (m: Mesh | null) => {
    if (m) lightMeshes.current[i] = m;
  };

  return (
    <group position={[ax, y, az]}>
      <mesh position={[0, 0.08, 0]} material={M.concrete} receiveShadow>
        <boxGeometry args={[10, 0.15, 7.5]} />
      </mesh>
      {[-2.6, -0.2].map((x, i) => (
        <group key={i} position={[x, 0, 1.6]}>
          <mesh position={[0, 0.5, 0]} material={M.building} castShadow receiveShadow>
            <boxGeometry args={[2.0, 1.0, 2.6]} />
          </mesh>
          <mesh position={[0, 1.05, 0]} material={M.roofBlue}>
            <boxGeometry args={[2.1, 0.1, 2.7]} />
          </mesh>
          <GasLight position={[0, 0.75, 1.3]} base={WARM_BASE} meshRef={pushRef(i)} />
        </group>
      ))}
      {[
        [2.6, 2.0],
        [4.1, 2.0],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 1.25, 0]} material={M.white} castShadow>
            <sphereGeometry args={[0.75, 32, 20]} />
          </mesh>
          <GasLight position={[0, 2.03, 0]} base={WARM_BASE} meshRef={pushRef(2 + i)} />
        </group>
      ))}
      <mesh position={[-3.2, 2.3, -1.6]} material={M.steel} castShadow>
        <cylinderGeometry args={[0.3, 0.3, 4.6, 16]} />
      </mesh>
      <mesh position={[-2.2, 1.8, -1.9]} material={M.steel} castShadow>
        <cylinderGeometry args={[0.22, 0.22, 3.6, 16]} />
      </mesh>
      {Array.from({ length: 6 }, (_, i) => [0.5 + (i % 3) * 1.15, -2.2 + Math.floor(i / 3) * 1.15] as const).map(
        ([x, z], i) => (
          <mesh key={i} position={[x, 0.4, z]} material={M.steelDark} castShadow>
            <boxGeometry args={[1.05, 0.8, 1.05]} />
          </mesh>
        ),
      )}
      {[
        [-4.7, -3.4],
        [4.7, -3.4],
        [-4.7, 3.4],
        [4.7, 3.4],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 1, 0]} material={M.steelDark}>
            <cylinderGeometry args={[0.03, 0.03, 2.0, 6]} />
          </mesh>
          <GasLight position={[0, 2.2, 0]} base={WHITE_BASE} meshRef={pushRef(4 + i)} />
        </group>
      ))}
      <Flare position={[4.4, 0, -3.0]} height={4.2} scale={0.7} getIntensity={(s) => Math.max(0, s.gasFlow * 1.2 - 0.5) * 2} />
    </group>
  );
}
