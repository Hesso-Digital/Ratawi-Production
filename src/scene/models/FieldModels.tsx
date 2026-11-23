/**
 * GLB versions of the field assets, placed exactly where the procedural ones
 * stand (origin at base centre, scale 1, see public/models/README.md), with the
 * procedural components as the Suspense / error fallback. Timeline-driven parts
 * (inlet valves, gas lights, flames, well beacons) keep reacting to the cues.
 */
import { useFrame } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Color, InstancedMesh, Matrix4, Mesh, Object3D, type Material } from 'three';
import { AG25_WORLD, CPF_WORLD, EXPORT_LINE_WORLD, WORLD_WELLS, heightAt } from '../world';
import { useSceneClockRef } from '../useSceneClock';
import { hdr } from '../shaders/materials';
import { CPF1 } from '../facilities/CPF1';
import { AG25 } from '../facilities/AG25';
import { Wells } from '../Wells';
import type { QualityProfile } from '../quality';
import { ModelBoundary } from './ModelBoundary';
import { cloneForScene, emissiveUnder, hasFieldModel, nodeNamed, preloadFieldModels, useFieldGLTF, type FieldModelName } from './glbLoader';

preloadFieldModels(['cpf1', 'ag25', 'wellhead', 'wellhead_agup', 'export_marker']);

const VALVE_CLOSED = new Color('#ff5a3c');
const VALVE_OPEN = new Color('#3dffb0');

function Slot({ name, fallback, children }: { name: FieldModelName; fallback: ReactNode; children: ReactNode }) {
  if (!hasFieldModel(name)) return <>{fallback}</>;
  return (
    <ModelBoundary fallback={fallback}>
      <Suspense fallback={fallback}>{children}</Suspense>
    </ModelBoundary>
  );
}

/** Records which GLBs actually rendered (read by the release checks as window.__ratawiModels). */
function useMarkLoaded(name: FieldModelName) {
  useEffect(() => {
    const w = window as unknown as { __ratawiModels?: string[] };
    w.__ratawiModels = [...new Set([...(w.__ratawiModels ?? []), name])];
  }, [name]);
}

function flicker(node: Object3D | undefined, t: number, k: number, seed: number) {
  if (!node) return;
  node.visible = k > 0.02;
  const s = Math.max(0.0001, k) * (0.92 + 0.08 * Math.sin(t * 17 + seed) + 0.05 * Math.sin(t * 29 + seed * 2));
  node.scale.set(1, s, 1);
}

function CPF1Glb({ shadows }: { shadows: boolean }) {
  const gltf = useFieldGLTF('cpf1');
  useMarkLoaded('cpf1');
  const sceneClock = useSceneClockRef();
  const [cx, cz] = CPF_WORLD;
  const y = heightAt(cx, cz) + 0.02;
  const { root, valves, flames } = useMemo(() => {
    const root = cloneForScene(gltf.scene, { shadows });
    const valves = [1, 2, 3].map((i) => emissiveUnder(root, `InletValve_${i}`));
    const flames = [nodeNamed(root, 'Flame_Core'), nodeNamed(root, 'Flame_Tip')];
    return { root, valves, flames };
  }, [gltf, shadows]);

  useFrame(() => {
    const { valves: v, t } = sceneClock.current;
    valves.forEach((mats, i) => {
      const local = Math.min(1, Math.max(0, v * 1.6 - i * 0.3));
      const k = 1.6 + 2.4 * local + (v > 0 && v < 1 ? 0.8 * Math.sin(t * 12 + i) : 0);
      const c = hdr(VALVE_CLOSED.clone().lerp(VALVE_OPEN, local), k);
      for (const m of mats) m.color.copy(c);
    });
    flames.forEach((n, i) => flicker(n, t, 1, i));
  });

  return (
    <group position={[cx, y, cz]}>
      <primitive object={root} />
      <pointLight color="#ffd6a0" intensity={10} distance={16} decay={1.5} position={[0, 4, 0]} />
    </group>
  );
}

function AG25Glb({ shadows }: { shadows: boolean }) {
  const gltf = useFieldGLTF('ag25');
  useMarkLoaded('ag25');
  const sceneClock = useSceneClockRef();
  const [ax, az] = AG25_WORLD;
  const y = heightAt(ax, az) + 0.02;
  const { root, lights, flames } = useMemo(() => {
    const root = cloneForScene(gltf.scene, { shadows });
    const lights = [...emissiveUnder(root, 'GasLights'), ...emissiveUnder(root, 'MastLights')];
    const flames = [nodeNamed(root, 'Flame_Core'), nodeNamed(root, 'Flame_Tip')];
    return { root, lights, flames };
  }, [gltf, shadows]);

  useFrame(() => {
    const { gasFlow, t } = sceneClock.current;
    const live = Math.min(1, Math.max(0, gasFlow * 1.2));
    for (const m of lights) m.color.copy(m.userData.base as Color).multiplyScalar(0.25 + 1.4 * live);
    const flameK = Math.max(0, gasFlow * 1.2 - 0.5) * 2;
    flames.forEach((n, i) => flicker(n, t, Math.min(1, flameK), i + 3));
  });

  return (
    <group position={[ax, y, az]}>
      <primitive object={root} />
    </group>
  );
}

/** Nodes the procedural instanced beacons/rings already animate per cue. */
const WELL_SKIP = /^(Beacon|StatusRing)/i;

function useInstancedParts(root: Object3D, count: number) {
  return useMemo(() => {
    root.updateMatrixWorld(true);
    const parts: Array<{ mesh: InstancedMesh; local: Matrix4 }> = [];
    root.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      let skip = false;
      for (let p: Object3D | null = mesh; p && p !== root; p = p.parent) if (WELL_SKIP.test(p.name)) skip = true;
      if (skip) return;
      const im = new InstancedMesh(mesh.geometry, mesh.material as Material, count);
      im.castShadow = mesh.castShadow;
      im.receiveShadow = mesh.receiveShadow;
      im.raycast = () => {};
      parts.push({ mesh: im, local: mesh.matrixWorld.clone() });
    });
    return parts;
  }, [root, count]);
}

function WellSet({ name, wells, shadows }: { name: 'wellhead' | 'wellhead_agup'; wells: typeof WORLD_WELLS; shadows: boolean }) {
  const gltf = useFieldGLTF(name);
  useMarkLoaded(name);
  const root = useMemo(() => cloneForScene(gltf.scene, { shadows }), [gltf, shadows]);
  const parts = useInstancedParts(root, wells.length);
  const group = useRef<Object3D>(null);

  useEffect(() => {
    const place = new Object3D();
    const m = new Matrix4();
    wells.forEach((w, i) => {
      place.position.set(w.world[0], heightAt(w.world[0], w.world[1]), w.world[1]);
      // Face the flowline stub towards the well's parent / CPF-1.
      place.rotation.set(0, Math.atan2(-(w.parentWorld[1] - w.world[1]), w.parentWorld[0] - w.world[0]), 0);
      place.updateMatrix();
      for (const p of parts) {
        m.multiplyMatrices(place.matrix, p.local);
        p.mesh.setMatrixAt(i, m);
      }
    });
    for (const p of parts) {
      p.mesh.instanceMatrix.needsUpdate = true;
      p.mesh.computeBoundingSphere();
    }
  }, [parts, wells]);

  return (
    <group ref={group}>
      {parts.map((p, i) => (
        <primitive key={i} object={p.mesh} />
      ))}
    </group>
  );
}

const ONLINE = WORLD_WELLS.filter((w) => w.kind === 'online');
const AGUP = WORLD_WELLS.filter((w) => w.kind === 'agup');

function WellsGlb({ quality }: { quality: QualityProfile }) {
  return (
    <>
      <WellSet name="wellhead" wells={ONLINE} shadows={quality.shadows} />
      <WellSet name="wellhead_agup" wells={AGUP} shadows={quality.shadows} />
      <Wells quality={quality} hideStatic mastAligned />
    </>
  );
}

function ExportMarkersGlb({ shadows }: { shadows: boolean }) {
  const gltf = useFieldGLTF('export_marker');
  useMarkLoaded('export_marker');
  const roots = useMemo(
    () => EXPORT_LINE_WORLD.slice(1).map(() => cloneForScene(gltf.scene, { shadows })),
    [gltf, shadows],
  );
  return (
    <>
      {EXPORT_LINE_WORLD.slice(1).map(([x, z], i) => (
        <group key={i} position={[x, heightAt(x, z), z + 0.9]} scale={1.4}>
          <primitive object={roots[i]} />
        </group>
      ))}
    </>
  );
}

export function FieldFacilities({ quality }: { quality: QualityProfile }) {
  return (
    <>
      <Slot name="cpf1" fallback={<CPF1 />}>
        <CPF1Glb shadows={quality.shadows} />
      </Slot>
      <Slot name="ag25" fallback={<AG25 />}>
        <AG25Glb shadows={quality.shadows} />
      </Slot>
      {/* The detailed wellheads add ~280k triangles across 32 wells; the low profile
          (?quality=low, laptops) keeps the light procedural wells. */}
      {quality.id === 'low' ? (
        <Wells quality={quality} />
      ) : (
        <Slot name="wellhead" fallback={<Wells quality={quality} />}>
          {hasFieldModel('wellhead_agup') ? <WellsGlb quality={quality} /> : <Wells quality={quality} />}
        </Slot>
      )}
      <Slot name="export_marker" fallback={null}>
        <ExportMarkersGlb shadows={quality.shadows} />
      </Slot>
    </>
  );
}
