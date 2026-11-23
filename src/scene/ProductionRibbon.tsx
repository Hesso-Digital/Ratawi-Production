/**
 * Playback mode ribbon: the Jun 2026 → Apr 2027 trajectory as a glowing line
 * in a camera-facing vertical plane above the field, with dashed 90/120
 * reference lines and month labels. Simplified from design-3d/src/scene.js
 * `layoutRibbon` (P1 per plan section 8: the milestone shockwave is the P0
 * celebration beat; this ribbon only appears during "Play story").
 */
import { Html, Line } from '@react-three/drei';
import { useMemo } from 'react';
import { CPF_WORLD, heightAt } from './world';
import { BUDGET_KBOPD, TARGET_KBOPD, TRAJECTORY } from '../data/defaults';

const ORIGIN_OFFSET: [number, number, number] = [-6, 9, -26];
const WIDTH = 66;
const Y_SCALE = 0.16;

function point(i: number, value: number): [number, number, number] {
  const [cx, cz] = CPF_WORLD;
  const baseY = heightAt(cx, cz);
  const u = (i / (TRAJECTORY.length - 1) - 0.5) * WIDTH;
  return [cx + ORIGIN_OFFSET[0] + u, baseY + ORIGIN_OFFSET[1] + value * Y_SCALE, cz + ORIGIN_OFFSET[2]];
}

export function ProductionRibbon() {
  const ribbonPoints = useMemo(() => TRAJECTORY.map((p, i) => point(i, p.oil)), []);
  const baselinePoints = useMemo(() => TRAJECTORY.map((_, i) => point(i, 0)), []);
  const commitmentPoints = useMemo(() => TRAJECTORY.map((_, i) => point(i, BUDGET_KBOPD)), []);
  const targetPoints = useMemo(() => TRAJECTORY.map((_, i) => point(i, TARGET_KBOPD)), []);

  const callouts = useMemo(
    () =>
      [
        { i: 0, label: 'Jun · Shutdown', value: '0' },
        { i: 4, label: 'Oct · Peak', value: '108' },
        { i: 5, label: 'Nov · Today', value: '105' },
        { i: 6, label: 'Dec · AGUP RFSU', value: '120' },
        { i: 10, label: 'Apr 2027', value: '130' },
      ] as const,
    [],
  );

  return (
    <group>
      <Line points={baselinePoints} color="#6c8098" lineWidth={1} transparent opacity={0.5} />
      <Line points={commitmentPoints} color="#9fb3c8" lineWidth={1} dashed dashSize={0.6} gapSize={0.4} />
      <Line points={targetPoints} color="#ffc247" lineWidth={1.5} dashed dashSize={0.6} gapSize={0.4} />
      <Line points={ribbonPoints} color="#38d6ff" lineWidth={3} />
      {TRAJECTORY.map((p, i) => (
        <Html key={p.key} position={point(i, 0)} center distanceFactor={60} occlude={false}>
          <div className="ribbon-month">{p.label}</div>
        </Html>
      ))}
      {callouts.map((c) => (
        <Html key={c.i} position={point(c.i, TRAJECTORY[c.i].oil)} center distanceFactor={48} occlude={false}>
          <div className={`ribbon-callout ${c.i >= 6 ? 'gold' : ''}`}>
            <div className="m">{c.label}</div>
            <div className="v">{c.value}</div>
          </div>
        </Html>
      ))}
    </group>
  );
}
