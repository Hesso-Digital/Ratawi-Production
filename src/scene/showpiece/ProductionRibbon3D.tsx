/**
 * 3D production ribbon: the June 2026 to May 2027 oil series as a glowing
 * band rising over the field, cyan to gold by value and neon magenta for the
 * forecast months after November, with a soft curtain down
 * to the ground, a month axis, commitment and target reference lines and the
 * milestones read from the series. It draws itself on when the view opens and
 * follows the HUD timeline: scrubbing or playing the timeline moves the head.
 */
import { Html, Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { BufferAttribute, BufferGeometry, Color, DoubleSide, SRGBColorSpace, MeshBasicMaterial, type Group, type Mesh } from 'three';
import { asOfStore, TIMELINE_LAST_INDEX, useAsOfState } from '../../data/asOfStore';
import { WORDING } from '../../data/ceremonyConfig';
import { PLAYBACK_END_INDEX, TODAY_INDEX, TRAJECTORY } from '../../data/defaults';
import { isAgupOnline } from '../../data/presets';
import { snapshotAtMonth } from '../../data/series';
import { useCeremonyStore } from '../../data/store';
import { ribbonBlend, useViewMode } from '../../state/sceneSettings';
import type { QualityProfile } from '../quality';
import { RIBBON, ribbonColorAt, ribbonMilestones, ribbonX, ribbonY, ribbonZ, sampleSeries } from './layout';

type V3 = [number, number, number];
const lin = new Color();
/** Vertex colours are linear; the palette is authored in sRGB. */
function toLinear([r, g, b]: [number, number, number]): [number, number, number] {
  lin.setRGB(r, g, b, SRGBColorSpace);
  return [lin.r, lin.g, lin.b];
}
const MONTHS = TRAJECTORY.length;

function buildBand(samples: Array<{ i: number; v: number }>, commitment: number, target: number) {
  const n = samples.length;
  const pos = new Float32Array(n * 2 * 3);
  const col = new Float32Array(n * 2 * 4);
  const curtainPos = new Float32Array(n * 2 * 3);
  const curtainCol = new Float32Array(n * 2 * 4);
  samples.forEach(({ i, v }, k) => {
    const z = ribbonZ(i, MONTHS);
    const x = ribbonX(i, MONTHS);
    const y = ribbonY(v);
    const [r0, g0, b0] = toLinear(ribbonColorAt(i, v, commitment, target, TODAY_INDEX));
    const [r, g, b] = [r0 * 0.72, g0 * 0.72, b0 * 0.72];
    const half = RIBBON.width / 2;
    // Band: tilted toward the camera so it catches light like a sheet; brighter leading edge.
    pos.set([x - half * 0.3, y - RIBBON.height, z, x + half * 0.3, y, z], k * 6);
    col.set([r * 0.35, g * 0.35, b * 0.35, 0.35, r, g, b, 0.95], k * 8);
    curtainPos.set([x - half * 0.3, RIBBON.baseY - 1.5, z, x - half * 0.3, y - RIBBON.height, z], k * 6);
    curtainCol.set([r, g, b, 0, r, g, b, 0.07], k * 8);
  });
  const index: number[] = [];
  for (let k = 0; k < n - 1; k++) {
    const a = k * 2;
    index.push(a, a + 1, a + 3, a, a + 3, a + 2);
  }
  const make = (p: Float32Array, c: Float32Array) => {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(p, 3));
    g.setAttribute('color', new BufferAttribute(c, 4));
    g.setIndex(index);
    return g;
  };
  return { band: make(pos, col), curtain: make(curtainPos, curtainCol), quads: n - 1 };
}

export function ProductionRibbon3D({ quality }: { quality: QualityProfile }) {
  const { viewMode } = useViewMode();
  const open = viewMode === 'ribbon';
  const store = useCeremonyStore();
  const asOf = useAsOfState();
  const online = isAgupOnline(store.snapshot, store.presets) || store.cue.kind === 'step2' || store.step >= 2;
  const { commitmentKbopd, targetKbopd } = store.presets;
  const presetsKey = JSON.stringify(store.presets);

  // The same month values the HUD shows when the timeline is scrubbed.
  const values = useMemo(
    () => TRAJECTORY.map((_, i) => snapshotAtMonth(i, store.presets, online).oil),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [presetsKey, online],
  );
  const spm = quality.id === 'low' ? RIBBON.samplesPerMonthLow : RIBBON.samplesPerMonth;
  const samples = useMemo(() => sampleSeries(values, spm), [values, spm]);
  const geo = useMemo(() => buildBand(samples, commitmentKbopd, targetKbopd), [samples, commitmentKbopd, targetKbopd]);
  const edge = useMemo(() => samples.map(({ i, v }) => [ribbonX(i, MONTHS) + RIBBON.width * 0.15, ribbonY(v), ribbonZ(i, MONTHS)] as V3), [samples]);
  const edgeColors = useMemo(
    () => samples.map(({ i, v }) => ribbonColorAt(i, v, commitmentKbopd, targetKbopd, TODAY_INDEX).map((c) => c * 0.9) as [number, number, number]),
    [samples, commitmentKbopd, targetKbopd],
  );
  const milestones = useMemo(() => ribbonMilestones(TRAJECTORY, values, PLAYBACK_END_INDEX), [values]);
  // Dashed neon overlay along the forecast months, lifted just above the band edge.
  const forecastEdge = useMemo(
    () =>
      samples
        .filter(({ i }) => i >= TODAY_INDEX - 1e-6)
        .map(({ i, v }) => [ribbonX(i, MONTHS) + RIBBON.width * 0.15, ribbonY(v) + 0.9, ribbonZ(i, MONTHS)] as V3),
    [samples],
  );
  const forecastMid = Math.min(TRAJECTORY.length - 1, TODAY_INDEX + (TRAJECTORY.length - 1 - TODAY_INDEX) / 2);

  const mats = useMemo(
    () => ({
      band: new MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, side: DoubleSide, depthWrite: false, toneMapped: false }),
      curtain: new MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, side: DoubleSide, depthWrite: false, toneMapped: false }),
    }),
    [],
  );

  const group = useRef<Group>(null);
  const head = useRef<Mesh>(null);
  const edgeRef = useRef<{ geometry: { instanceCount: number }; material: { opacity: number } } | null>(null);
  const refLines = useRef<Array<{ material: { opacity: number } } | null>>([]);
  const forecastRef = useRef<{ material: { opacity: number } } | null>(null);
  /** Draw-on progress 0→1, eased after the view opens. */
  const drawOn = useRef(0);

  useFrame((_, dt) => {
    const b = ribbonBlend.value;
    const g = group.current;
    if (!g) return;
    g.visible = b > 0.002;
    if (!g.visible) {
      drawOn.current = 0;
      return;
    }
    const opening = open;
    drawOn.current = opening ? Math.min(1, drawOn.current + dt / 2.2) : drawOn.current;
    const eased = 1 - Math.pow(1 - drawOn.current, 3);
    const idx = asOfStore.get().index;
    const cursor = idx == null ? 1 : idx / TIMELINE_LAST_INDEX;
    const f = Math.max(0.001, Math.min(eased, cursor));
    const quads = Math.max(1, Math.round(f * geo.quads));
    geo.band.setDrawRange(0, quads * 6);
    geo.curtain.setDrawRange(0, quads * 6);
    mats.band.opacity = b;
    mats.curtain.opacity = quality.id === 'low' ? 0 : b;
    const e = edgeRef.current;
    if (e) {
      e.geometry.instanceCount = quads;
      e.material.opacity = b;
    }
    for (const l of refLines.current) if (l) l.material.opacity = b * 0.7;
    const fl = forecastRef.current;
    if (fl) fl.material.opacity = b * Math.max(0, Math.min(1, (f * TIMELINE_LAST_INDEX - TODAY_INDEX) / 1.5));
    const h = head.current;
    if (h) {
      const s = samples[Math.min(samples.length - 1, quads)];
      h.position.set(ribbonX(s.i, MONTHS) + RIBBON.width * 0.15, ribbonY(s.v), ribbonZ(s.i, MONTHS));
      h.visible = f < 0.999;
    }
  });

  const refLine = (v: number): V3[] => [
    [RIBBON.x, ribbonY(v), RIBBON.zStart + 2],
    [RIBBON.x, ribbonY(v), RIBBON.zEnd - 2],
  ];
  const cursorIndex = asOf.index == null ? TIMELINE_LAST_INDEX : asOf.index;
  const cursorMonth = TRAJECTORY[Math.round(cursorIndex)];
  const cursorValue = asOf.index == null ? values[values.length - 1] : snapshotAtMonth(asOf.index, store.presets, online).oil;

  return (
    <group ref={group} visible={false}>
      <mesh geometry={geo.band} material={mats.band} renderOrder={3} />
      <mesh geometry={geo.curtain} material={mats.curtain} renderOrder={2} />
      <Line
        ref={edgeRef as never}
        points={edge}
        vertexColors={edgeColors}
        lineWidth={2.4}
        transparent
        opacity={0}
        toneMapped={false}
      />
      {[commitmentKbopd, targetKbopd].map((v, i) => (
        <Line
          key={i}
          ref={(l) => {
            refLines.current[i] = l as never;
          }}
          points={refLine(v)}
          color={i === 1 ? '#ffc247' : '#9fb3c8'}
          lineWidth={1}
          dashed
          dashSize={1}
          gapSize={0.8}
          transparent
          opacity={0}
        />
      ))}
      {forecastEdge.length > 1 ? (
        <Line
          ref={forecastRef as never}
          points={forecastEdge}
          color="#ff4fd8"
          lineWidth={2}
          dashed
          dashSize={0.9}
          gapSize={0.7}
          transparent
          opacity={0}
          toneMapped={false}
        />
      ) : null}
      <mesh ref={head}>
        <sphereGeometry args={[0.7, 16, 12]} />
        <meshBasicMaterial color="#fff4d6" toneMapped={false} />
      </mesh>
      {open ? (
        <group>
          {[
            { v: commitmentKbopd, label: WORDING.commitmentLabel },
            { v: targetKbopd, label: WORDING.targetLabel },
          ].map((r) => (
            <Html key={r.label} position={[RIBBON.x, ribbonY(r.v), RIBBON.zStart + 4]} center zIndexRange={[11, 0]} style={{ pointerEvents: 'none' }}>
              <div className="xv-ref">
                {r.label} <b>{r.v}</b>
              </div>
            </Html>
          ))}
          {milestones.map((m) => (
            <Html
              key={m.index}
              position={[ribbonX(m.index, MONTHS), ribbonY(m.value) + 3.6, ribbonZ(m.index, MONTHS)]}
              center
              zIndexRange={[11, 0]}
              style={{ pointerEvents: 'none' }}
            >
              <div
                className={`xv-milestone${m.index <= cursorIndex + 1e-6 ? ' on' : ''}${m.index > TODAY_INDEX ? ' forecast' : m.value >= targetKbopd - 1e-6 ? ' gold' : ''}`}
              >
                <span>{m.tag}</span>
                <b>{Math.round(m.value)}</b>
              </div>
            </Html>
          ))}
          <Html
            position={[ribbonX(forecastMid, MONTHS), ribbonY(values[Math.round(forecastMid)] ?? 0) + 8, ribbonZ(forecastMid, MONTHS)]}
            center
            zIndexRange={[11, 0]}
            style={{ pointerEvents: 'none' }}
          >
            <div className="xv-forecast-label">Forecast · Dec to {TRAJECTORY[TRAJECTORY.length - 1].label}</div>
          </Html>
          {TRAJECTORY.map((m, i) => (
            <Html key={m.key} position={[ribbonX(i, MONTHS) + 3, 0.6, ribbonZ(i, MONTHS)]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
              <div className={`xv-month${Math.round(cursorIndex) === i ? ' on' : ''}${i > TODAY_INDEX ? ' forecast' : ''}`}>{m.label}</div>
            </Html>
          ))}
          {asOf.index != null && cursorMonth ? (
            <Html position={[ribbonX(cursorIndex, MONTHS), ribbonY(cursorValue) - RIBBON.height - 2, ribbonZ(cursorIndex, MONTHS)]} center zIndexRange={[12, 0]} style={{ pointerEvents: 'none' }}>
              <div className="xv-cursor">
                {cursorMonth.label} {cursorMonth.year} · <b>{cursorValue.toFixed(1)}</b> kbopd
                {cursorIndex > TODAY_INDEX + 0.5 ? <span className="forecast-tag"> · Forecast</span> : null}
              </div>
            </Html>
          ) : null}
        </group>
      ) : null}
    </group>
  );
}
