/**
 * All 32 wellheads, instanced (plan section 8: "instance everything repeated").
 * Five InstancedMesh draws cover every well regardless of count: pad, tree
 * body, beacon, beam pillar and ground ring. Only the three glowing parts get
 * a per-frame colour update; pad/tree are painted once at mount.
 * Ported from design-3d/src/scene.js `buildWell` + the per-frame well block in
 * `RatawiScene.apply`.
 */
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Color, CylinderGeometry, DoubleSide, InstancedMesh, Object3D, RingGeometry } from 'three';
import { heightAt, WORLD_WELLS } from './world';
import { hdr } from './shaders/materials';
import { useSceneClockRef } from './useSceneClock';
import type { QualityProfile } from './quality';

const COL_OIL = new Color('#38d6ff');
const COL_AGUP_IDLE = new Color('#ff9a2e');
const COL_GOLD = new Color('#ffc247');

const dummy = new Object3D();
const AGUP_ORDER = WORLD_WELLS.filter((w) => w.kind === 'agup').map((w) => w.name);

export function Wells({ quality }: { quality: QualityProfile }) {
  const sceneClock = useSceneClockRef();
  const padRef = useRef<InstancedMesh>(null);
  const bodyRef = useRef<InstancedMesh>(null);
  const beaconRef = useRef<InstancedMesh>(null);
  const beamRef = useRef<InstancedMesh>(null);
  const ringRef = useRef<InstancedMesh>(null);

  const count = WORLD_WELLS.length;
  const wellY = useMemo(() => WORLD_WELLS.map((w) => heightAt(w.world[0], w.world[1])), []);

  const { padGeo, bodyGeo, beaconGeo, beamGeo, ringGeo } = useMemo(
    () => ({
      padGeo: new CylinderGeometry(0.62, 0.62, 0.08, 8),
      bodyGeo: new CylinderGeometry(0.1, 0.12, 0.7, 10),
      beaconGeo: new CylinderGeometry(0.12, 0.12, 0.2, 10),
      beamGeo: new CylinderGeometry(0.03, 0.09, 3.6, 8, 1, true),
      ringGeo: new RingGeometry(0.72, 0.82, 32),
    }),
    [],
  );

  // Static parts: positioned once the instanced meshes exist (after mount).
  useEffect(() => {
    const pad = padRef.current;
    const body = bodyRef.current;
    if (!pad || !body) return;
    WORLD_WELLS.forEach((w, i) => {
      const y = wellY[i];
      dummy.position.set(w.world[0], y + 0.04, w.world[1]);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      pad.setMatrixAt(i, dummy.matrix);
      dummy.position.set(w.world[0], y + 0.08 + 0.35, w.world[1]);
      dummy.updateMatrix();
      body.setMatrixAt(i, dummy.matrix);
    });
    pad.instanceMatrix.needsUpdate = true;
    body.instanceMatrix.needsUpdate = true;
  }, [wellY]);

  useFrame(() => {
    const beacon = beaconRef.current;
    const beam = beamRef.current;
    const ring = ringRef.current;
    if (!beacon || !beam || !ring) return;
    const { t, agupIgnite, agupWave } = sceneClock.current;

    WORLD_WELLS.forEach((w, i) => {
      const y = wellY[i];
      let col = COL_OIL;
      let k = 6;
      let beamK = 1;
      let ringK = 1;
      let pulse = 1;

      if (w.kind === 'online') {
        pulse = quality.microAnimations ? 0.85 + 0.15 * Math.sin(t * 2 + i) : 1;
      } else {
        const order = AGUP_ORDER.indexOf(w.name);
        const local = Math.min(1, Math.max(0, agupWave * 8 - order));
        if (agupIgnite < 1) {
          col = COL_AGUP_IDLE;
          k = 1.6;
          beamK = 0;
          ringK = 0.35;
        } else if (agupIgnite < 2) {
          col = COL_AGUP_IDLE;
          k = 7;
          beamK = 0.9;
          pulse = quality.microAnimations ? 0.7 + 0.3 * Math.sin(t * 6 + order) : 1;
          ringK = 1.2;
        } else {
          col = COL_AGUP_IDLE.clone().lerp(COL_GOLD, local);
          k = 7 + 5 * local;
          beamK = 0.9 + 0.8 * local;
          ringK = 1 + local;
        }
      }

      const beaconColor = hdr(col, k * pulse);
      dummy.position.set(w.world[0], y + 0.08 + 0.72, w.world[1]);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      beacon.setMatrixAt(i, dummy.matrix);
      beacon.setColorAt(i, beaconColor);

      const beamVisible = beamK > 0.02;
      dummy.position.set(w.world[0], y + 0.08 + 0.95 + 1.8, w.world[1]);
      dummy.scale.set(1, beamVisible ? 1 : 0.0001, 1);
      dummy.updateMatrix();
      beam.setMatrixAt(i, dummy.matrix);
      beam.setColorAt(i, hdr(col, 0.9 * beamK));

      dummy.position.set(w.world[0], y + 0.1, w.world[1]);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      ring.setMatrixAt(i, dummy.matrix);
      ring.setColorAt(i, hdr(col, 1.1 * ringK * (w.kind === 'agup' && agupIgnite < 1 ? 0.6 : 1)));
    });

    beacon.instanceMatrix.needsUpdate = true;
    beam.instanceMatrix.needsUpdate = true;
    ring.instanceMatrix.needsUpdate = true;
    if (beacon.instanceColor) beacon.instanceColor.needsUpdate = true;
    if (beam.instanceColor) beam.instanceColor.needsUpdate = true;
    if (ring.instanceColor) ring.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={padRef} args={[padGeo, undefined, count]} castShadow receiveShadow>
        <meshStandardMaterial color="#4a4a4c" roughness={0.95} />
      </instancedMesh>
      <instancedMesh ref={bodyRef} args={[bodyGeo, undefined, count]} castShadow>
        <meshStandardMaterial color="#9aa1a8" metalness={0.5} roughness={0.5} />
      </instancedMesh>
      <instancedMesh ref={beaconRef} args={[beaconGeo, undefined, count]}>
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={beamRef} args={[beamGeo, undefined, count]}>
        <meshBasicMaterial toneMapped={false} transparent opacity={0.55} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={ringRef} args={[ringGeo, undefined, count]}>
        <meshBasicMaterial toneMapped={false} transparent opacity={0.8} depthWrite={false} side={DoubleSide} />
      </instancedMesh>
    </group>
  );
}
