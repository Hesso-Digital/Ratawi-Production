/**
 * Replay ribbon: the June to December 2026 trajectory as a glowing line in a
 * camera-facing plane above the field. It draws itself as the replay runs, with
 * a bright head, month labels and callouts that appear as the head passes them.
 * It reads the same replay progress as the HUD bar and the KPI tiles.
 */
import { Html, Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { Mesh } from 'three';
import { RIBBON_LAYOUT } from './ceremonyTimeline';
import { BUDGET_KBOPD, PLAYBACK_END_INDEX, TARGET_KBOPD, TRAJECTORY } from '../data/defaults';
import { WORDING } from '../data/ceremonyConfig';
import { useSceneClockRef, useSceneSnapshot } from './useSceneClock';

const SAMPLES_PER_MONTH = 16;
const MONTHS = TRAJECTORY.slice(0, PLAYBACK_END_INDEX + 1);

function point(index: number, value: number): [number, number, number] {
  const u = (index / PLAYBACK_END_INDEX - 0.5) * RIBBON_LAYOUT.width;
  return [RIBBON_LAYOUT.x, RIBBON_LAYOUT.baseY + value * RIBBON_LAYOUT.yPerKbopd, RIBBON_LAYOUT.zCenter + u];
}

const CALLOUTS = [
  { i: 0, label: 'Jun · Shutdown' },
  { i: 4, label: 'Oct · Peak' },
  { i: 5, label: 'Nov · Today' },
  { i: 6, label: 'Dec · AGUP RFSU' },
] as const;

export function ProductionRibbon() {
  const sceneClock = useSceneClockRef();
  const state = useSceneSnapshot();
  const headRef = useRef<Mesh>(null);
  const lineRef = useRef<{ geometry: { instanceCount: number } } | null>(null);

  const dense = useMemo(() => {
    const out: Array<[number, number, number]> = [];
    for (let m = 0; m < PLAYBACK_END_INDEX; m++) {
      for (let s = 0; s < SAMPLES_PER_MONTH; s++) {
        const f = s / SAMPLES_PER_MONTH;
        out.push(point(m + f, MONTHS[m].oil + (MONTHS[m + 1].oil - MONTHS[m].oil) * f));
      }
    }
    out.push(point(PLAYBACK_END_INDEX, MONTHS[PLAYBACK_END_INDEX].oil));
    return out;
  }, []);
  const baseline = useMemo(() => MONTHS.map((_, i) => point(i, 0)), []);
  const commitment = useMemo(() => MONTHS.map((_, i) => point(i, BUDGET_KBOPD)), []);
  const target = useMemo(() => MONTHS.map((_, i) => point(i, TARGET_KBOPD)), []);

  useFrame(() => {
    const progress = sceneClock.current.playback?.progress ?? 0;
    const segs = dense.length - 1;
    const line = lineRef.current;
    if (line) line.geometry.instanceCount = Math.max(1, Math.ceil(progress * segs));
    const head = headRef.current;
    if (head) {
      const idx = progress * segs;
      const lo = Math.min(segs, Math.floor(idx));
      const hi = Math.min(segs, lo + 1);
      const f = idx - lo;
      head.position.set(
        dense[lo][0] + (dense[hi][0] - dense[lo][0]) * f,
        dense[lo][1] + (dense[hi][1] - dense[lo][1]) * f,
        dense[lo][2] + (dense[hi][2] - dense[lo][2]) * f,
      );
    }
  });

  const index = state.playback?.index ?? 0;

  return (
    <group>
      <Line points={baseline} color="#6c8098" lineWidth={1} transparent opacity={0.5} />
      <Line points={commitment} color="#9fb3c8" lineWidth={1} dashed dashSize={0.6} gapSize={0.4} />
      <Line points={target} color="#ffc247" lineWidth={1.5} dashed dashSize={0.6} gapSize={0.4} />
      <Line ref={lineRef as never} points={dense} color="#38d6ff" lineWidth={3.5} />
      <mesh ref={headRef}>
        <sphereGeometry args={[0.55, 16, 12]} />
        <meshBasicMaterial color={[4, 4.6, 5]} toneMapped={false} />
      </mesh>
      {MONTHS.map((p, i) => (
        <Html key={p.key} position={point(i, 0)} center distanceFactor={60} occlude={false}>
          <div className="ribbon-month" style={{ opacity: i <= index + 0.5 ? 1 : 0.35 }}>
            {p.label}
          </div>
        </Html>
      ))}
      <Html position={point(0, BUDGET_KBOPD)} center={false} distanceFactor={60} occlude={false}>
        <div className="ribbon-month" style={{ transform: 'translate(-110%, 0)' }}>
          {WORDING.commitmentLabel} {BUDGET_KBOPD}
        </div>
      </Html>
      {CALLOUTS.map((c) => (
        <Html key={c.i} position={point(c.i, MONTHS[c.i].oil)} center distanceFactor={48} occlude={false}>
          <div
            className={`ribbon-callout ${c.i >= PLAYBACK_END_INDEX ? 'gold' : ''}`}
            style={{ opacity: index >= c.i - 0.05 ? 1 : 0, transition: 'opacity .3s' }}
          >
            <div className="m">{c.label}</div>
            <div className="v">{MONTHS[c.i].oil}</div>
          </div>
        </Html>
      ))}
    </group>
  );
}
