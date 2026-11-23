/**
 * Every flowline in the field: well → parent → CPF-1 oil gathering, the CPF-1
 * → AG-25 gas pipe and the indicative export line, drawn as energy flows
 * (shaders/energyFlow.ts): cyan for the existing network, amber for the AGUP
 * wells and the gas to AG-25, bright cores with a crackling glow moving
 * downstream, and thin braided strands around each gathering line so the
 * network reads like rivers gathering into CPF-1 (concept 01).
 *
 * Everything is merged into a handful of draw calls: one energy mesh (cores,
 * braids, glow shells) and one pipe mesh. Flows off shows the plain steel
 * pipes only. Day mode keeps a slim gold / graphite pipe (the sand-model
 * linework of concept 04) with a softer energy layer on top. The low quality
 * profile drops the braids, glow shells and noise.
 */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { BufferAttribute, CatmullRomCurve3, Color, MeshStandardMaterial, TubeGeometry, Vector3, type BufferGeometry, type Mesh } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { dayBlend, sceneSettings } from '../state/sceneSettings';
import { AG25_WORLD, CPF_WORLD, EXPORT_LINE_WORLD, WORLD_WELLS, pathPoints } from './world';
import { createEnergyFlowMaterial, hdrVec, FLOW_GROUP_COUNT } from './shaders/energyFlow';
import { useSceneClockRef } from './useSceneClock';
import { focusGain } from './explore/areas';
import { exploreStore } from './explore/exploreStore';
import { NORTH_WELL_NAMES, SOUTH_WELL_NAMES } from '../data/field';
import type { QualityProfile } from './quality';

const COL_OIL = new Color('#2fd4ff');
const COL_AGUP_IDLE = new Color('#ff8a1f');
const COL_GOLD = new Color('#ffb63a');
const COL_GAS = new Color('#ff9a2a');
const COL_EXPORT = new Color('#8fe6ff');
const COL_EXPORT_GOLD = new Color('#ffd27a');

/** Group index per vertex: colour, progress and focus dimming are uniforms per group. */
const G = { oilN: 0, oilS: 1, oilO: 2, agupN: 3, agupS: 4, agupO: 5, gas: 6, export: 7 } as const;
const NORTH = new Set<string>(NORTH_WELL_NAMES);
const SOUTH = new Set<string>(SOUTH_WELL_NAMES);
const SAMPLE_NORTH = NORTH_WELL_NAMES[0];
const SAMPLE_SOUTH = SOUTH_WELL_NAMES[0];

const STEEL = new Color('#8b939b');
const DAY_GOLD = new Color('#b8913a');
const DAY_GRAPHITE = new Color('#55595f');

function curveFrom(points: Array<[number, number, number]>) {
  return new CatmullRomCurve3(points.map(([x, y, z]) => new Vector3(x, y, z)), false, 'centripetal', 0.1);
}

/** A strand winding around `base` in the ground plane, pinched to the line at both ends. */
function braidCurve(base: CatmullRomCurve3, amp: number, waves: number, phase: number, lift: number) {
  const n = 48;
  const pts: Vector3[] = [];
  const p = new Vector3();
  const tan = new Vector3();
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    base.getPointAt(u, p);
    base.getTangentAt(u, tan);
    const side = new Vector3(-tan.z, 0, tan.x).normalize();
    const env = Math.sin(Math.PI * u);
    const w = Math.sin(u * waves * Math.PI * 2 + phase);
    pts.push(p.clone().addScaledVector(side, amp * env * w).add(new Vector3(0, lift * env * (0.5 + 0.5 * Math.cos(u * waves * Math.PI * 2 + phase)), 0)));
  }
  return new CatmullRomCurve3(pts, false, 'centripetal', 0.3);
}

function tagged(geo: TubeGeometry, group: number, len: number, phase: number, kind: number): BufferGeometry {
  const count = geo.attributes.position.count;
  const a = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    a[i * 4] = group;
    a[i * 4 + 1] = len;
    a[i * 4 + 2] = phase;
    a[i * 4 + 3] = kind;
  }
  geo.setAttribute('aFlow', new BufferAttribute(a, 4));
  return geo;
}

function coloured(geo: TubeGeometry, color: Color): BufferGeometry {
  const count = geo.attributes.position.count;
  const c = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    c[i * 3] = color.r;
    c[i * 3 + 1] = color.g;
    c[i * 3 + 2] = color.b;
  }
  geo.setAttribute('color', new BufferAttribute(c, 3));
  geo.deleteAttribute('uv');
  return geo;
}

type Line = { curve: CatmullRomCurve3; len: number; group: number; radius: number; glow: number; braids: number; pipeColor: Color };

export function FlowLines({ quality }: { quality: QualityProfile }) {
  const sceneClock = useSceneClockRef();
  const rich = quality.id !== 'low';

  const { energyGeometry, pipeGeometry } = useMemo(() => {
    let seed = 7;
    const rnd = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    const lines: Line[] = [];
    for (const w of WORLD_WELLS) {
      const curve = curveFrom(pathPoints([w.world, w.parentWorld], 0.14));
      const isAgup = w.kind === 'agup';
      const zone = NORTH.has(w.name) ? 0 : SOUTH.has(w.name) ? 1 : 2;
      lines.push({
        curve,
        len: curve.getLength(),
        group: (isAgup ? G.agupN : G.oilN) + zone,
        radius: isAgup ? 0.075 : 0.06,
        glow: isAgup ? 0.32 : 0.26,
        braids: 2,
        pipeColor: isAgup ? DAY_GOLD : DAY_GRAPHITE,
      });
    }
    const gas = curveFrom(
      pathPoints([CPF_WORLD, [CPF_WORLD[0] + 2.2, CPF_WORLD[1] - 4.4], [AG25_WORLD[0] - 1.0, AG25_WORLD[1] + 3.0], AG25_WORLD], 0.55),
    );
    lines.push({ curve: gas, len: gas.getLength(), group: G.gas, radius: 0.16, glow: 0.55, braids: 3, pipeColor: DAY_GOLD });
    const exp = curveFrom(pathPoints([CPF_WORLD, ...EXPORT_LINE_WORLD.slice(1)], 0.25));
    lines.push({ curve: exp, len: exp.getLength(), group: G.export, radius: 0.11, glow: 0.4, braids: 0, pipeColor: DAY_GRAPHITE });

    const energy: BufferGeometry[] = [];
    const pipes: BufferGeometry[] = [];
    for (const l of lines) {
      const seg = Math.max(12, Math.ceil(l.len * 3));
      const phase = rnd();
      energy.push(tagged(new TubeGeometry(l.curve, seg, l.radius, 8, false), l.group, l.len, phase, 0));
      pipes.push(coloured(new TubeGeometry(l.curve, Math.max(8, Math.ceil(l.len * 1.5)), l.radius * 0.8, 8, false), l.pipeColor));
      if (!rich) continue;
      energy.push(tagged(new TubeGeometry(l.curve, Math.max(8, Math.ceil(l.len * 1.5)), l.glow, 10, false), l.group, l.len, phase, 2));
      for (let b = 0; b < l.braids; b++) {
        const strand = braidCurve(l.curve, l.radius * 3.2 + 0.1, Math.max(1, Math.round(l.len / 7)) + b, phase * 6.28 + b * 2.1, 0.06);
        energy.push(tagged(new TubeGeometry(strand, seg, Math.max(0.016, l.radius * 0.28), 5, false), l.group, l.len, rnd(), 1));
      }
    }
    return { energyGeometry: mergeGeometries(energy), pipeGeometry: mergeGeometries(pipes) };
  }, [rich]);

  const energyMaterial = useMemo(() => createEnergyFlowMaterial({ crackle: rich }), [rich]);
  // Flows off (night or day): plain steel pipes. Day with flows on: gold / graphite linework.
  const steelMaterial = useMemo(() => new MeshStandardMaterial({ color: STEEL, metalness: 0.75, roughness: 0.32, envMapIntensity: 1.2 }), []);
  const lineMaterial = useMemo(() => new MeshStandardMaterial({ vertexColors: true, metalness: 0.55, roughness: 0.4, transparent: true, opacity: 1 }), []);

  const energyRef = useRef<Mesh>(null);
  const pipesRef = useRef<Mesh>(null);

  useFrame(() => {
    const { t, agupFlow, gasFlow, gold, oilFlow, agupIgnite } = sceneClock.current;
    const flowsOn = sceneSettings.get().flows;
    const day = dayBlend.value;
    const energy = energyRef.current;
    const pipes = pipesRef.current;
    if (energy) energy.visible = flowsOn;
    if (pipes) {
      pipes.material = flowsOn ? lineMaterial : steelMaterial;
      pipes.visible = !flowsOn || day > 0.02;
      lineMaterial.opacity = day;
    }
    if (!flowsOn) return;

    const u = energyMaterial.uniforms;
    u.uTime.value = t;
    // Additive light washes out on bright sand: keep a lighter energy layer by day.
    u.uOpacity.value = 1 - 0.55 * day;
    const areaId = exploreStore.get().areaId;
    const gains = u.uGain.value as number[];
    gains[G.oilN] = focusGain(areaId, 'oil', SAMPLE_NORTH);
    gains[G.oilS] = focusGain(areaId, 'oil', SAMPLE_SOUTH);
    gains[G.oilO] = focusGain(areaId, 'oil', undefined);
    gains[G.agupN] = focusGain(areaId, 'agup', SAMPLE_NORTH);
    gains[G.agupS] = focusGain(areaId, 'agup', SAMPLE_SOUTH);
    gains[G.agupO] = focusGain(areaId, 'agup', undefined);
    gains[G.gas] = focusGain(areaId, 'gas');
    gains[G.export] = focusGain(areaId, 'export');

    const prog = u.uProgress.value as number[];
    const speed = u.uSpeed.value as number[];
    const cols = u.uColor.value as Vector3[];
    const oilK = 0.55 + 1.0 * oilFlow;
    const agupCol = agupIgnite >= 2 ? COL_GOLD : COL_AGUP_IDLE;
    for (let g = 0; g < FLOW_GROUP_COUNT; g++) {
      if (g <= G.oilO) {
        prog[g] = 1;
        speed[g] = 3.2;
        hdrVec(COL_OIL, oilK, cols[g]);
      } else if (g <= G.agupO) {
        prog[g] = agupFlow;
        speed[g] = 3.8;
        hdrVec(agupCol, 1.9, cols[g]);
      }
    }
    prog[G.gas] = gasFlow;
    speed[G.gas] = 3.4;
    hdrVec(COL_GAS, 2.2, cols[G.gas]);
    prog[G.export] = 1;
    speed[G.export] = 5.5;
    hdrVec(COL_EXPORT.clone().lerp(COL_EXPORT_GOLD, gold), 1.2 + gold * 0.6, cols[G.export]);
  });

  return (
    <group>
      <mesh ref={pipesRef} name="ratawi-flow-pipes" geometry={pipeGeometry} material={steelMaterial} castShadow={false} receiveShadow />
      <mesh ref={energyRef} name="ratawi-energy-flows" geometry={energyGeometry} material={energyMaterial} frustumCulled={false} renderOrder={3} />
    </group>
  );
}
