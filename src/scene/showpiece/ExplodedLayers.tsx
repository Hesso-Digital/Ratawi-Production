/**
 * Exploded layer view: the field opens into stacked glass layers inside a red
 * glowing concession prism. Top = surface facilities (lifted by LayerLift),
 * middle = gathering network (FlowLines, lifted), bottom = a reservoir slab with
 * every well rising out of it as a vertical light thread. Slim 3D callouts sit
 * on their objects and read the same KPI values as the HUD.
 */
import { Html, Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, type ReactNode } from 'react';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  ExtrudeGeometry,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NormalBlending,
  RepeatWrapping,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  type Group,
} from 'three';
import { WELLS as WELL_CONFIG, WORDING } from '../../data/ceremonyConfig';
import { useCeremonyStore } from '../../data/store';
import { useDisplayedKpis } from '../../hooks/useDisplayedKpis';
import { CountText } from '../../components/CountText';
import { dayBlend, explodeBlend, useViewMode } from '../../state/sceneSettings';
import { useSceneSnapshot } from '../useSceneClock';
import { AG25_WORLD, CONCESSION_WORLD, CPF_WORLD, EXPORT_LINE_WORLD, WORLD_WELLS, type Vec2 } from '../world';
import type { QualityProfile } from '../quality';
import { EXPLODED_FACING, FIELD_BOUNDS, FIELD_CENTER, LAYERS, layerLift, scalePolygon } from './layout';

type V3 = [number, number, number];

function shapeOf(poly: readonly Vec2[]): Shape {
  const s = new Shape();
  poly.forEach(([x, z], i) => (i === 0 ? s.moveTo(x, -z) : s.lineTo(x, -z)));
  s.closePath();
  return s;
}

function slab(poly: readonly Vec2[], depth: number) {
  const g = new ExtrudeGeometry(shapeOf(poly), { depth, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  return g;
}

function loop(poly: readonly Vec2[], y: number): V3[] {
  const pts = poly.map(([x, z]) => [x, y, z] as V3);
  pts.push(pts[0]);
  return pts;
}

/** Side walls between two loops; vertex alpha fades toward the top. */
function prismWalls(bottom: readonly Vec2[], top: readonly Vec2[], y0: number, y1: number) {
  const pos: number[] = [];
  const col: number[] = [];
  const n = bottom.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const quad: Array<[Vec2, number, number]> = [
      [bottom[i], y0, 1],
      [bottom[j], y0, 1],
      [top[j], y1, 0.25],
      [bottom[i], y0, 1],
      [top[j], y1, 0.25],
      [top[i], y1, 0.25],
    ];
    for (const [[x, z], y, a] of quad) {
      pos.push(x, y, z);
      col.push(1, 1, 1, a);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('color', new BufferAttribute(new Float32Array(col), 4));
  return g;
}

/** Seeded streaks of teal "oil-bearing rock" for the reservoir cap. */
function reservoirTexture(): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  let seed = 11;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  ctx.fillStyle = '#05181d';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 220; i++) {
    const bright = rnd() > 0.9;
    ctx.strokeStyle = bright ? `rgba(110,236,255,${0.55 + rnd() * 0.4})` : `rgba(30,170,190,${0.18 + rnd() * 0.3})`;
    ctx.lineWidth = bright ? 1.2 : 0.6 + rnd() * 1.6;
    const x = rnd() * 512;
    const y = rnd() * 512;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + (rnd() - 0.3) * 260, y + (rnd() - 0.5) * 120, x + (rnd() - 0.3) * 260, y + (rnd() - 0.5) * 120, x + (rnd() - 0.2) * 360, y + (rnd() - 0.5) * 80);
    ctx.stroke();
  }
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(120,240,255,${rnd() * 0.25})`;
    ctx.fillRect(rnd() * 512, rnd() * 512, 1.2, 1.2);
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(1 / 40, 1 / 40);
  return t;
}

const NIGHT_EDGE = new Color('#bfeaff');
const DAY_EDGE = new Color('#1f5f86');
const RED = new Color('#ff3b3b');
const RED_DAY = new Color('#d81f1f');
const CYAN = new Color('#38d6ff');
const GOLD = new Color('#ffc247');
const tmpColor = new Color();
const tmpM = new Matrix4();

const RESERVOIR_TOP = LAYERS.reservoir.y + LAYERS.reservoir.thickness;

type LineHandle = { material: { opacity: number; color: Color } };

function Callout({ anchor, label, children }: { anchor: V3; label: V3; children: ReactNode }) {
  return (
    <group>
      <Line points={[anchor, label]} color="#e8f4ff" lineWidth={1} transparent opacity={0.55} />
      <mesh position={anchor}>
        <sphereGeometry args={[0.32, 10, 8]} />
        <meshBasicMaterial color="#e8f4ff" toneMapped={false} />
      </mesh>
      <Html position={label} center zIndexRange={[12, 0]} style={{ pointerEvents: 'none' }}>
        <div className="xv-callout">{children}</div>
      </Html>
    </group>
  );
}

export function ExplodedLayers({ quality }: { quality: QualityProfile }) {
  const group = useRef<Group>(null);
  const { viewMode } = useViewMode();
  const open = viewMode === 'exploded';
  const live = useSceneSnapshot();
  const kpi = useDisplayedKpis(live);
  const target = useCeremonyStore().presets.targetKbopd;
  const simple = quality.id === 'low';

  const geo = useMemo(() => {
    const surfacePoly = scalePolygon(CONCESSION_WORLD, 1.0);
    return {
      glass: slab(surfacePoly, 0.35),
      reservoir: slab(scalePolygon(CONCESSION_WORLD, 0.99), LAYERS.reservoir.thickness),
      surfaceLoop: loop(surfacePoly, 0),
      cap: (() => {
        const g = new ShapeGeometry(shapeOf(scalePolygon(CONCESSION_WORLD, 0.99)));
        g.rotateX(-Math.PI / 2);
        return g;
      })(),
      prismBottom: scalePolygon(CONCESSION_WORLD, LAYERS.prismBottomScale),
      prismTop: scalePolygon(CONCESSION_WORLD, LAYERS.prismTopScale),
    };
  }, []);
  const walls = useMemo(
    () => prismWalls(geo.prismBottom, geo.prismTop, 0.15, LAYERS.prismTop),
    [geo],
  );
  const verticals = useMemo(
    () => geo.prismBottom.map((b, i) => [[b[0], 0.15, b[1]], [geo.prismTop[i][0], LAYERS.prismTop, geo.prismTop[i][1]]] as V3[]),
    [geo],
  );

  const mats = useMemo(() => {
    const tex = reservoirTexture();
    return {
      glassNet: new MeshStandardMaterial({ color: '#8fd8ff', transparent: true, opacity: 0, roughness: 0.08, metalness: 0.1, depthWrite: false, side: DoubleSide }),
      glassTop: new MeshStandardMaterial({ color: '#b9e6ff', transparent: true, opacity: 0, roughness: 0.08, metalness: 0.1, depthWrite: false, side: DoubleSide }),
      reservoir: new MeshStandardMaterial({
        color: '#0a2a33',
        emissive: '#ffffff',
        emissiveMap: tex,
        emissiveIntensity: 2.4,
        map: tex,
        transparent: true,
        opacity: 0,
        roughness: 0.35,
        metalness: 0.2,
      }),
      veins: new MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
      walls: new MeshBasicMaterial({ color: RED, vertexColors: true, transparent: true, opacity: 0, side: DoubleSide, depthWrite: false, blending: AdditiveBlending, toneMapped: false }),
      threads: new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending, toneMapped: false }),
      core: new MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending, toneMapped: false }),
    };
  }, []);

  const threads = useMemo(() => {
    const m = new InstancedMesh(new CylinderThread(), mats.threads, WORLD_WELLS.length);
    m.frustumCulled = false;
    return m;
  }, [mats]);

  const edgeRefs = useRef<Array<LineHandle | null>>([]);
  const redRefs = useRef<Array<LineHandle | null>>([]);
  const netGlass = useRef<Group>(null);
  const topGlass = useRef<Group>(null);
  const core = useRef<Group>(null);

  const agupLit = kpi.wells > kpi.currentWells + 0.5;

  useFrame(({ clock }) => {
    const b = explodeBlend.value;
    const g = group.current;
    if (!g) return;
    g.visible = b > 0.002;
    if (!g.visible) return;
    const day = dayBlend.value;
    const netY = layerLift('network', b);
    const topY = layerLift('surface', b);
    // Layers fade in as they separate.
    const a = Math.min(1, b * 1.4);
    if (netGlass.current) netGlass.current.position.y = netY - 0.75;
    if (topGlass.current) topGlass.current.position.y = topY - 0.65;
    mats.glassNet.opacity = a * (0.1 + day * 0.06);
    mats.glassTop.opacity = a * (0.13 + day * 0.07);
    mats.reservoir.opacity = a * 0.96;
    mats.veins.opacity = a * (0.9 - day * 0.35);
    mats.walls.opacity = a * (simple ? 0 : 0.06 + day * 0.05);
    mats.walls.blending = day > 0.5 ? NormalBlending : AdditiveBlending;
    mats.walls.color.copy(RED).lerp(RED_DAY, day);
    tmpColor.copy(NIGHT_EDGE).lerp(DAY_EDGE, day);
    for (const l of edgeRefs.current) {
      if (!l) continue;
      l.material.opacity = a * 0.75;
      l.material.color.copy(tmpColor);
    }
    for (const l of redRefs.current) {
      if (!l) continue;
      l.material.opacity = a * 0.95;
      l.material.color.copy(RED).lerp(RED_DAY, day);
    }
    // Well threads: reservoir top up to the lifted wellhead.
    const pulse = quality.microAnimations ? 0.75 + 0.25 * Math.sin(clock.elapsedTime * 2.2) : 1;
    const span = Math.max(0.01, topY - RESERVOIR_TOP);
    WORLD_WELLS.forEach((w, i) => {
      tmpM.makeScale(1, span, 1);
      tmpM.setPosition(w.world[0], RESERVOIR_TOP, w.world[1]);
      threads.setMatrixAt(i, tmpM);
      const lit = w.kind === 'online' || agupLit;
      threads.setColorAt(i, tmpColor.copy(w.kind === 'agup' ? GOLD : CYAN).multiplyScalar(lit ? 1 : 0.25));
    });
    threads.instanceMatrix.needsUpdate = true;
    if (threads.instanceColor) threads.instanceColor.needsUpdate = true;
    mats.threads.opacity = a * 0.85 * pulse;
    mats.core.opacity = a * 0.9;
    if (core.current) {
      core.current.position.set(CPF_WORLD[0], RESERVOIR_TOP, CPF_WORLD[1]);
      core.current.scale.set(1, span, 1);
    }
  });

  // Callout anchors (scene units), placed for the south-east framing.
  const netY = LAYERS.network.lift;
  const topY = LAYERS.surface.lift;
  const westWell = WORLD_WELLS.reduce((m, w) => (w.world[0] < m.world[0] ? w : m), WORLD_WELLS[0]);
  const exportEnd = EXPORT_LINE_WORLD[EXPORT_LINE_WORLD.length - 1];
  const wellsAnchor: V3 = [westWell.world[0], netY + 0.4, westWell.world[1]];
  const wellsLabel: V3 = [FIELD_BOUNDS.minX - 4, netY + 5, FIELD_BOUNDS.maxZ + 14];
  const gasAnchor: V3 = [AG25_WORLD[0], topY + 3, AG25_WORLD[1]];
  const gasLabel: V3 = [FIELD_BOUNDS.minX - 8, topY + 9, FIELD_BOUNDS.maxZ + 4];
  const exportAnchor: V3 = [exportEnd[0], netY + 0.4, exportEnd[1]];
  const exportLabel: V3 = [exportEnd[0] + 22, netY + 3, exportEnd[1] - 16];
  // The headline sits on the reservoir face nearest the camera.
  const heroPos: V3 = [FIELD_CENTER[0] + EXPLODED_FACING[0] * 20, LAYERS.reservoir.y + 0.5, FIELD_CENTER[1] + EXPLODED_FACING[1] * 20];
  const above = kpi.oil > target + 0.05;
  const onTarget = Math.abs(kpi.oil - target) <= 0.05;

  return (
    <group ref={group} visible={false}>
      {/* Reservoir slab */}
      <mesh geometry={geo.reservoir} material={mats.reservoir} position={[0, LAYERS.reservoir.y, 0]} />
      <mesh geometry={geo.cap} material={mats.veins} position={[0, RESERVOIR_TOP + 0.04, 0]} />
      <Line
        ref={(l) => {
          edgeRefs.current[0] = l as unknown as LineHandle;
        }}
        points={loop(CONCESSION_WORLD, RESERVOIR_TOP + 0.02)}
        color="#bfeaff"
        lineWidth={1.2}
        transparent
        opacity={0}
      />
      {/* Gathering network glass */}
      <group ref={netGlass}>
        <mesh geometry={geo.glass} material={mats.glassNet} />
        <Line
          ref={(l) => {
            edgeRefs.current[1] = l as unknown as LineHandle;
          }}
          points={loop(CONCESSION_WORLD, 0.36)}
          color="#bfeaff"
          lineWidth={1.4}
          transparent
          opacity={0}
        />
      </group>
      {/* Surface facilities glass */}
      <group ref={topGlass}>
        <mesh geometry={geo.glass} material={mats.glassTop} />
        <Line
          ref={(l) => {
            edgeRefs.current[2] = l as unknown as LineHandle;
          }}
          points={geo.surfaceLoop.map(([x, , z]) => [x, 0.36, z] as V3)}
          color="#bfeaff"
          lineWidth={1.6}
          transparent
          opacity={0}
        />
      </group>
      {/* Red concession prism */}
      {simple ? null : <mesh geometry={walls} material={mats.walls} renderOrder={2} />}
      {[loop(geo.prismBottom, 0.15), loop(geo.prismTop, LAYERS.prismTop), ...verticals].map((pts, i) => (
        <Line
          key={i}
          ref={(l) => {
            redRefs.current[i] = l as unknown as LineHandle;
          }}
          points={pts}
          color="#ff3b3b"
          lineWidth={i < 2 ? 2.4 : 1.6}
          transparent
          opacity={0}
        />
      ))}
      {/* Wells as light threads, and the CPF-1 export column */}
      <primitive object={threads} />
      <group ref={core}>
        <mesh material={mats.core} position={[0, 0.5, 0]}>
          <cylinderGeometry args={[0.32, 0.32, 1, 12, 1, true]} />
        </mesh>
        {simple ? null : (
          <mesh material={mats.core} position={[0, 0.5, 0]} scale={[3.2, 1, 3.2]}>
            <cylinderGeometry args={[0.32, 0.32, 1, 16, 1, true]} />
          </mesh>
        )}
      </group>
      {open ? (
        <group>
          <Callout anchor={wellsAnchor} label={wellsLabel}>
            <span className="k">Wells online</span>
            <b>
              <CountText value={kpi.wells} />
              <small> of {WELL_CONFIG.total}</small>
            </b>
          </Callout>
          <Callout anchor={gasAnchor} label={gasLabel}>
            <span className="k">Gas to AG-25</span>
            <b>
              <CountText value={kpi.gas} />
              <small> MMscfd</small>
            </b>
          </Callout>
          <Callout anchor={exportAnchor} label={exportLabel}>
            <span className="k">Export</span>
            <b>
              <CountText value={kpi.exportKbopd} />
              <small> kbopd</small>
            </b>
          </Callout>
          <Html position={heroPos} center zIndexRange={[11, 0]} style={{ pointerEvents: 'none' }}>
            <div className={`xv-hero${kpi.oil >= target - 1e-6 ? ' gold' : ''}`}>
              <b>
                <CountText value={kpi.oil} decimals={1} />
                <small> kbopd</small>
              </b>
              <span>
                {above
                  ? 'Oil production above target'
                  : onTarget
                    ? 'Oil production on target'
                    : `Oil production · ${WORDING.targetLabel} ${target}`}
              </span>
            </div>
          </Html>
        </group>
      ) : null}
    </group>
  );
}

/** Unit-height open cylinder with its base at y = 0, for the well threads. */
class CylinderThread extends BufferGeometry {
  constructor() {
    super();
    const seg = 6;
    const r = 0.1;
    const pos: number[] = [];
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2;
      const a1 = ((i + 1) / seg) * Math.PI * 2;
      const p = (a: number, y: number) => [Math.cos(a) * r, y, Math.sin(a) * r];
      pos.push(...p(a0, 0), ...p(a1, 0), ...p(a1, 1), ...p(a0, 0), ...p(a1, 1), ...p(a0, 1));
    }
    this.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  }
}
