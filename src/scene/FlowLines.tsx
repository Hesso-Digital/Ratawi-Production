/**
 * Every flowline in the field: well → parent → CPF-1 oil gathering, the CPF-1
 * → AG-25 gas pipe, and the indicative export line, each with a progress-
 * wavefront shader tube plus a shared GPU particle buffer for the flow dots.
 * Ported from design-3d/src/scene.js `addFlow` / `buildNetwork` and the
 * particle block in `RatawiScene.apply`.
 */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { BufferAttribute, BufferGeometry, CatmullRomCurve3, Color, MeshStandardMaterial, Points, TubeGeometry, Vector3, type Mesh } from 'three';
import { sceneSettings } from '../state/sceneSettings';
import { AG25_WORLD, CPF_WORLD, EXPORT_LINE_WORLD, WORLD_WELLS, pathPoints } from './world';
import { createFlowMaterial, createPointsMaterial, hdr } from './shaders/materials';
import { createGlowSprite } from './textures';
import { useSceneClockRef } from './useSceneClock';
import { focusGain } from './explore/areas';
import { exploreStore } from './explore/exploreStore';
import type { QualityProfile } from './quality';

const COL_OIL = new Color('#38d6ff');
const COL_AGUP_IDLE = new Color('#ff9a2e');
const COL_GOLD = new Color('#ffc247');
const COL_GAS = new Color('#a77bff');
const COL_EXPORT = new Color('#ffe2a8');
const IDLE_DIM = new Color('#1b3240');
const IDLE_GOLD_DIM = new Color('#3a2a14');
const IDLE_GAS_DIM = new Color('#1e1a2e');
const IDLE_EXPORT_DIM = new Color('#2a2418');

type FlowKind = 'oil' | 'agup' | 'gas' | 'export';

type Flow = {
  kind: FlowKind;
  curve: CatmullRomCurve3;
  len: number;
  dots: number;
  speed: number;
  size: number;
  offset: number;
  wellName?: string;
};

function curveFrom(points: Array<[number, number, number]>) {
  return new CatmullRomCurve3(
    points.map(([x, y, z]) => new Vector3(x, y, z)),
    false,
    'centripetal',
    0.1,
  );
}

export function FlowLines({ quality }: { quality: QualityProfile }) {
  const sceneClock = useSceneClockRef();
  const pointsRef = useRef<Points>(null);
  const tubeRefs = useRef<Map<string, Mesh>>(new Map());

  const { flows, tubes } = useMemo(() => {
    const scale = quality.particleScale;
    const dotsFor = (base: number) => Math.max(2, Math.round(base * scale));
    const flows: Flow[] = [];
    const tubes: Array<{ id: string; geometry: TubeGeometry; material: ReturnType<typeof createFlowMaterial>; kind: FlowKind; wellName?: string }> = [];

    let seed = 0;
    const nextOffset = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    WORLD_WELLS.forEach((w) => {
      const points = pathPoints([w.world, w.parentWorld], 0.14);
      const curve = curveFrom(points);
      const len = curve.getLength();
      const isAgup = w.kind === 'agup';
      const material = createFlowMaterial(hdr(isAgup ? COL_AGUP_IDLE : COL_OIL, 1.5), isAgup ? IDLE_GOLD_DIM : IDLE_DIM, len);
      const geometry = new TubeGeometry(curve, Math.max(8, Math.ceil(len * 2)), 0.05, 8, false);
      const id = `well-${w.name}`;
      tubes.push({ id, geometry, material, kind: isAgup ? 'agup' : 'oil', wellName: w.name });
      flows.push({ kind: isAgup ? 'agup' : 'oil', curve, len, dots: dotsFor(isAgup ? 10 : 6), speed: 2.6, size: 0.55, offset: nextOffset(), wellName: w.name });
    });

    const gasPoints = pathPoints(
      [CPF_WORLD, [CPF_WORLD[0] + 2.2, CPF_WORLD[1] - 4.4], [AG25_WORLD[0] - 1.0, AG25_WORLD[1] + 3.0], AG25_WORLD],
      0.55,
    );
    const gasCurve = curveFrom(gasPoints);
    const gasLen = gasCurve.getLength();
    tubes.push({
      id: 'gas',
      geometry: new TubeGeometry(gasCurve, Math.max(8, Math.ceil(gasLen * 2)), 0.2, 8, false),
      material: createFlowMaterial(hdr(COL_GAS, 3.4), IDLE_GAS_DIM, gasLen),
      kind: 'gas',
    });
    flows.push({ kind: 'gas', curve: gasCurve, len: gasLen, dots: dotsFor(20), speed: 2.4, size: 1.1, offset: nextOffset() });

    const exportPoints = pathPoints([CPF_WORLD, ...EXPORT_LINE_WORLD.slice(1)], 0.25);
    const exportCurve = curveFrom(exportPoints);
    const exportLen = exportCurve.getLength();
    tubes.push({
      id: 'export',
      geometry: new TubeGeometry(exportCurve, Math.max(8, Math.ceil(exportLen * 2)), 0.12, 8, false),
      material: createFlowMaterial(hdr(COL_EXPORT, 1.4), IDLE_EXPORT_DIM, exportLen),
      kind: 'export',
    });
    flows.push({ kind: 'export', curve: exportCurve, len: exportLen, dots: dotsFor(60), speed: 5.5, size: 0.7, offset: nextOffset() });

    return { flows, tubes };
  }, [quality.particleScale]);

  const totalDots = useMemo(() => flows.reduce((s, f) => s + f.dots, 0), [flows]);

  const { particleGeometry, particleMaterial } = useMemo(() => {
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(totalDots * 3), 3));
    geo.setAttribute('aColor', new BufferAttribute(new Float32Array(totalDots * 3), 3));
    geo.setAttribute('aSize', new BufferAttribute(new Float32Array(totalDots), 1));
    return { particleGeometry: geo, particleMaterial: createPointsMaterial(createGlowSprite()) };
  }, [totalDots]);

  // Plain steel pipe shown instead of the animated glow tubes when Flows is off.
  const pipeMaterial = useMemo(() => new MeshStandardMaterial({ color: '#7d858c', metalness: 0.6, roughness: 0.45 }), []);

  useFrame(({ gl, size }) => {
    const { t, agupFlow, gasFlow, gold, oilFlow } = sceneClock.current;
    const areaId = exploreStore.get().areaId;
    const flowsOn = sceneSettings.get().flows;
    if (pointsRef.current) pointsRef.current.visible = flowsOn;
    if (!flowsOn) {
      for (const tube of tubes) {
        const mesh = tubeRefs.current.get(tube.id);
        if (mesh) mesh.material = pipeMaterial;
      }
      return;
    }

    for (const tube of tubes) {
      const mesh = tubeRefs.current.get(tube.id);
      if (!mesh) continue;
      mesh.material = tube.material;
      const mat = tube.material;
      const gain = focusGain(areaId, tube.kind, tube.wellName);
      mat.uniforms.uTime.value = t;
      if (tube.kind === 'oil') {
        mat.uniforms.uProgress.value = 1;
        mat.uniforms.uColor.value.copy(hdr(COL_OIL, 0.6 + 1.3 * oilFlow)).multiplyScalar(gain);
      } else if (tube.kind === 'agup') {
        mat.uniforms.uProgress.value = agupFlow;
        const flowColor = sceneClock.current.agupIgnite >= 2 ? COL_GOLD : COL_AGUP_IDLE;
        mat.uniforms.uColor.value.copy(hdr(flowColor, 2.2)).multiplyScalar(gain);
      } else if (tube.kind === 'gas') {
        mat.uniforms.uProgress.value = gasFlow;
        mat.uniforms.uColor.value.copy(hdr(COL_GAS, 3.4)).multiplyScalar(gain);
      } else if (tube.kind === 'export') {
        mat.uniforms.uProgress.value = 1;
        mat.uniforms.uColor.value.copy(hdr(COL_EXPORT.clone().lerp(COL_GOLD, gold), 1.3 + gold * 0.7)).multiplyScalar(gain);
      }
    }

    const pos = particleGeometry.attributes.position.array as Float32Array;
    const col = particleGeometry.attributes.aColor.array as Float32Array;
    const sizeAttr = particleGeometry.attributes.aSize.array as Float32Array;
    let k = 0;
    const v = new Vector3();
    for (const f of flows) {
      const gain = focusGain(areaId, f.kind, f.wellName);
      const active = f.kind === 'oil' ? 1 : f.kind === 'agup' ? (agupFlow > 0 ? 1 : 0) : f.kind === 'gas' ? (gasFlow > 0 ? 1 : 0) : 1;
      const progress = f.kind === 'oil' ? 1 : f.kind === 'agup' ? agupFlow : f.kind === 'gas' ? gasFlow : 1;
      const color =
        f.kind === 'oil'
          ? COL_OIL
          : f.kind === 'agup'
            ? sceneClock.current.agupIgnite >= 2
              ? COL_GOLD
              : COL_AGUP_IDLE
            : f.kind === 'gas'
              ? COL_GAS
              : COL_EXPORT.clone().lerp(COL_GOLD, gold);
      for (let d = 0; d < f.dots; d++) {
        const u = (f.offset + d / f.dots + (t * f.speed) / f.len) % 1;
        const visible = active && u <= progress;
        f.curve.getPointAt(u, v);
        pos[k * 3] = v.x;
        pos[k * 3 + 1] = v.y + 0.05;
        pos[k * 3 + 2] = v.z;
        const b = visible ? (f.kind === 'oil' ? 0.45 + 0.9 * oilFlow : 1.3) * gain : 0;
        col[k * 3] = color.r * b;
        col[k * 3 + 1] = color.g * b;
        col[k * 3 + 2] = color.b * b;
        sizeAttr[k] = f.size * (visible ? 1 : 0);
        k++;
      }
    }
    particleGeometry.attributes.position.needsUpdate = true;
    particleGeometry.attributes.aColor.needsUpdate = true;
    particleGeometry.attributes.aSize.needsUpdate = true;
    particleMaterial.uniforms.uScale.value = gl.getPixelRatio() * (size.height / 1080) * 6;
  });

  return (
    <group>
      {tubes.map((tube) => (
        <mesh
          key={tube.id}
          ref={(m) => {
            if (m) tubeRefs.current.set(tube.id, m);
          }}
          geometry={tube.geometry}
          material={tube.material}
        />
      ))}
      <points ref={pointsRef} geometry={particleGeometry} material={particleMaterial} frustumCulled={false} />
    </group>
  );
}
