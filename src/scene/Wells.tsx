/**
 * All 32 wellheads, instanced (plan section 8: "instance everything repeated").
 * Five InstancedMesh draws cover every well regardless of count: pad, tree
 * body, beacon, beam pillar and ground ring. Only the three glowing parts get
 * a per-frame colour update; pad/tree are painted once at mount.
 * Ported from design-3d/src/scene.js `buildWell` + the per-frame well block in
 * `RatawiScene.apply`.
 *
 * In GLB mode (`mastAligned`), the procedural pad/tree are hidden and the
 * beacon + beam sit on the v2 wellhead's Beacon mast (same yaw as WellSet).
 * The beam is shorter, thinner and fades as the camera gets close. The
 * low-quality procedural wells (`?quality=low`) keep the original tall beam
 * at the well centre.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Color, CylinderGeometry, InstancedBufferAttribute, InstancedMesh, MeshBasicMaterial, Object3D, PlaneGeometry } from 'three';
import { dayBlend } from '../state/sceneSettings';
import { createGroundRingMaterial, createPinGeometry, createPinMaterial } from './shaders/markers';
import { heightAt, WORLD_WELLS } from './world';
import { sceneSettings } from '../state/sceneSettings';
import { hdr } from './shaders/materials';
import { useSceneClockRef } from './useSceneClock';
import type { QualityProfile } from './quality';
import { beamOpacityForDistance, mastWorldPosition, pinScaleForDistance } from './wellMast';

const COL_OIL = new Color('#38d6ff');
const COL_AGUP_IDLE = new Color('#ff9a2e');
const COL_GOLD = new Color('#ffc247');

const dummy = new Object3D();
const AGUP_ORDER = WORLD_WELLS.filter((w) => w.kind === 'agup').map((w) => w.name);

/** GLB-mode beam: about one third the procedural height, thinner, softer. */
const GLB_BEAM_HEIGHT = 1.2;
const GLB_BEAM_OPACITY = 0.28;


export function Wells({
  quality,
  hideStatic = false,
  beaconLift = 0,
  mastAligned = false,
}: {
  quality: QualityProfile;
  /** Skip the procedural pad + tree when the GLB wellheads are drawn instead (models/FieldModels.tsx). */
  hideStatic?: boolean;
  /** Raise beacon and beam to sit on the taller GLB beacon mast. Unused when `mastAligned`. */
  beaconLift?: number;
  /**
   * Place the procedural beacon and beam at the v2 GLB Beacon mast top, with
   * the same per-well yaw as WellSet, and use the shorter close-fading beam.
   */
  mastAligned?: boolean;
}) {
  const sceneClock = useSceneClockRef();
  const camera = useThree((s) => s.camera);
  const padRef = useRef<InstancedMesh>(null);
  const bodyRef = useRef<InstancedMesh>(null);
  const beaconRef = useRef<InstancedMesh>(null);
  const beamRef = useRef<InstancedMesh>(null);
  const ringRef = useRef<InstancedMesh>(null);
  const beamMatRef = useRef<MeshBasicMaterial>(null);
  const pinMaterial = useMemo(() => createPinMaterial(), []);
  const ringMaterial = useMemo(() => createGroundRingMaterial(), []);

  const count = WORLD_WELLS.length;
  const wellY = useMemo(() => WORLD_WELLS.map((w) => heightAt(w.world[0], w.world[1])), []);
  const masts = useMemo(
    () => WORLD_WELLS.map((w, i) => mastWorldPosition(w.world, w.parentWorld, wellY[i])),
    [wellY],
  );

  const { padGeo, bodyGeo, beaconGeo, beamGeo, ringGeo } = useMemo(() => {
    const beam = mastAligned
      ? new CylinderGeometry(0.012, 0.036, GLB_BEAM_HEIGHT, 8, 1, true)
      : new CylinderGeometry(0.03, 0.09, 3.6, 8, 1, true);
    return {
      padGeo: new CylinderGeometry(0.62, 0.62, 0.08, 8),
      bodyGeo: new CylinderGeometry(0.1, 0.12, 0.7, 10),
      beaconGeo: (() => {
        const g = createPinGeometry();
        g.setAttribute('aAgup', new InstancedBufferAttribute(new Float32Array(WORLD_WELLS.map((w) => (w.kind === 'agup' ? 1 : 0))), 1));
        return g;
      })(),
      beamGeo: beam,
      ringGeo: new PlaneGeometry(2.8, 2.8),
    };
  }, [mastAligned]);

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
    // Flows off: keep the lit beacons steady, drop the beams and ground rings for clean model inspection.
    const flowsOn = sceneSettings.get().flows;
    const day = dayBlend.value;
    beam.visible = flowsOn && day < 0.98;
    ring.visible = flowsOn;
    pinMaterial.uniforms.uDay.value = day;
    ringMaterial.uniforms.uDay.value = day;
    ringMaterial.uniforms.uTime.value = t;
    ringMaterial.uniforms.uRipple.value = quality.microAnimations ? 1 : 0;

    if (mastAligned && beamMatRef.current) {
      let nearest = Infinity;
      for (const m of masts) {
        const dx = camera.position.x - m.x;
        const dy = camera.position.y - m.y;
        const dz = camera.position.z - m.z;
        const d = Math.hypot(dx, dy, dz);
        if (d < nearest) nearest = d;
      }
      beamMatRef.current.opacity = beamOpacityForDistance(nearest, GLB_BEAM_OPACITY);
    }

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

      const mast = masts[i];
      const beaconX = mastAligned ? mast.x : w.world[0];
      const beaconY = mastAligned ? mast.y : y + 0.08 + 0.72 + beaconLift;
      const beaconZ = mastAligned ? mast.z : w.world[1];
      const beamY = mastAligned ? mast.y + GLB_BEAM_HEIGHT / 2 : y + 0.08 + 0.95 + 1.8 + beaconLift;

      // Pin colour is kept moderate (it has its own rim glow); k is tuned for the old flat beacon.
      const beaconColor = hdr(col, k * 0.32 * (flowsOn ? pulse : 1));
      const tipY = mastAligned ? beamY + GLB_BEAM_HEIGHT / 2 + 0.05 : beaconY + 0.15;
      const dist = Math.hypot(camera.position.x - beaconX, camera.position.y - tipY, camera.position.z - beaconZ);
      dummy.rotation.set(0, 0, 0);
      dummy.position.set(beaconX, tipY, beaconZ);
      dummy.scale.setScalar(pinScaleForDistance(dist) * (w.kind === 'agup' ? 1.08 : 1));
      dummy.updateMatrix();
      beacon.setMatrixAt(i, dummy.matrix);
      beacon.setColorAt(i, beaconColor);

      const beamVisible = beamK > 0.02;
      dummy.position.set(beaconX, beamY, beaconZ);
      dummy.scale.set(1, beamVisible ? 1 : 0.0001, 1);
      dummy.updateMatrix();
      beam.setMatrixAt(i, dummy.matrix);
      beam.setColorAt(i, hdr(col, 0.9 * beamK));

      dummy.position.set(w.world[0], y + 0.1, w.world[1]);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.setScalar(1.25);
      dummy.updateMatrix();
      ring.setMatrixAt(i, dummy.matrix);
      ring.setColorAt(i, hdr(col, 1.4 * ringK * (w.kind === 'agup' && agupIgnite < 1 ? 0.6 : 1)));
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
      <instancedMesh ref={padRef} args={[padGeo, undefined, count]} castShadow receiveShadow visible={!hideStatic}>
        <meshStandardMaterial color="#4a4a4c" roughness={0.95} />
      </instancedMesh>
      <instancedMesh ref={bodyRef} args={[bodyGeo, undefined, count]} castShadow visible={!hideStatic}>
        <meshStandardMaterial color="#9aa1a8" metalness={0.5} roughness={0.5} />
      </instancedMesh>
      <instancedMesh ref={beaconRef} args={[beaconGeo, pinMaterial, count]} frustumCulled={false} />
      <instancedMesh ref={beamRef} args={[beamGeo, undefined, count]}>
        <meshBasicMaterial ref={beamMatRef} toneMapped={false} transparent opacity={mastAligned ? GLB_BEAM_OPACITY : 0.55} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={ringRef} args={[ringGeo, ringMaterial, count]} frustumCulled={false} renderOrder={2} />
    </group>
  );
}
