/**
 * Edge-only highlight of the active viewpoint (keys 1–8). A ground outline
 * and a clear wireframe prism (no filled plate, no tinted wall faces) stay
 * in sync with exploreStore.areaId / the camera fly-to. Does not edit well
 * or facility meshes; flow-line dimming stays in focusGain().
 */
import { Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import gsap from 'gsap';
import { useEffect, useMemo, useRef } from 'react';
import { EllipseCurve, type Group } from 'three';
import { useTimeOfDay } from '../../state/sceneSettings';
import { prefersReducedMotion, type AreaFootprint, areaFootprint } from './areas';
import { useExploreState } from './exploreStore';
import type { Vec2 } from '../world';

function ringPoints(cx: number, cz: number, rx: number, rz: number, y: number, closed = true): [number, number, number][] {
  const curve = new EllipseCurve(0, 0, rx, rz, 0, Math.PI * 2, false, 0);
  const pts = curve.getPoints(64).map((p) => [cx + p.x, y, cz + p.y] as [number, number, number]);
  if (closed && pts.length) pts.push(pts[0]);
  return pts;
}

function polyPoints(points: readonly Vec2[], y: number): [number, number, number][] {
  const pts = points.map((p) => [p[0], y, p[1]] as [number, number, number]);
  if (pts.length) pts.push(pts[0]);
  return pts;
}

function pathPoints(points: readonly Vec2[], y: number): [number, number, number][] {
  return points.map((p) => [p[0], y, p[1]] as [number, number, number]);
}

function footprintRing(foot: AreaFootprint, y: number): [number, number, number][] {
  if (foot.kind === 'polygon') return polyPoints(foot.points, y);
  if (foot.kind === 'ellipse') return ringPoints(foot.cx, foot.cz, foot.rx, foot.rz, y);
  return pathPoints(foot.points, y);
}

/** Open posts around the ring (skip the closing duplicate of a loop). */
function verticalPosts(ring: [number, number, number][], y1: number, count: number): [number, number, number][][] {
  if (ring.length < 2) return [];
  const looped = ring.length > 2 && ring[0][0] === ring[ring.length - 1][0] && ring[0][2] === ring[ring.length - 1][2];
  const open = looped ? ring.slice(0, -1) : ring;
  const n = Math.min(count, open.length);
  if (n <= 0) return [];
  const step = open.length / n;
  const posts: [number, number, number][][] = [];
  for (let i = 0; i < n; i++) {
    const p = open[Math.min(open.length - 1, Math.round(i * step)) % open.length];
    posts.push([p, [p[0], y1, p[2]]]);
  }
  return posts;
}

function wallHeight(foot: AreaFootprint): number {
  if (foot.id === 'aerial') return 2.2;
  if (foot.id === 'export') return 3.2;
  if (foot.id === 'north' || foot.id === 'south' || foot.id === 'agup') return 5;
  return 9;
}

function postCount(foot: AreaFootprint): number {
  if (foot.kind === 'polygon') return Math.max(foot.points.length, 4);
  if (foot.kind === 'path') return Math.min(Math.max(foot.points.length, 2), 8);
  if (foot.id === 'aerial') return 12;
  return 8;
}

function Outline({
  points,
  color,
  width,
  opacity,
}: {
  points: [number, number, number][];
  color: string;
  width: number;
  opacity: number;
}) {
  if (points.length < 2) return null;
  return <Line points={points} color={color} lineWidth={width} transparent opacity={opacity} depthWrite={false} />;
}

export function AreaFocusHighlight() {
  const { areaId } = useExploreState();
  const { mode } = useTimeOfDay();
  const next = useMemo(() => areaFootprint(areaId), [areaId]);
  const held = useRef<AreaFootprint | null>(next);
  if (next) held.current = next;
  const foot = next ?? held.current;
  const group = useRef<Group>(null);
  const amount = useRef({ v: 0 });

  useEffect(() => {
    const reduced = prefersReducedMotion();
    const dest = next ? 1 : 0;
    gsap.killTweensOf(amount.current);
    if (reduced) {
      amount.current.v = dest;
      return;
    }
    gsap.to(amount.current, { v: dest, duration: next ? 0.85 : 0.4, ease: 'power2.out' });
  }, [next]);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const v = amount.current.v;
    g.visible = v > 0.01;
    g.scale.setScalar(0.98 + 0.02 * v);
  });

  const rings = useMemo(() => {
    if (!foot) return null;
    const h = wallHeight(foot);
    const y0 = foot.y + 0.08;
    const y1 = foot.y + h;
    const bottom = footprintRing(foot, y0);
    const top = footprintRing(foot, y1);
    const posts = verticalPosts(bottom, y1, postCount(foot));
    return { bottom, top, posts };
  }, [foot]);

  if (!foot || !rings) return null;

  const day = mode === 'day';
  const color = day ? '#0d5c6d' : '#4dd0e1';
  const topColor = day ? '#164e5c' : '#7ee7ff';

  return (
    <group ref={group}>
      <Outline points={rings.bottom} color={color} width={1.8} opacity={0.9} />
      <Outline points={rings.top} color={topColor} width={2.2} opacity={0.95} />
      {rings.posts.map((pts, i) => (
        <Outline key={i} points={pts} color={color} width={1.2} opacity={0.55} />
      ))}
    </group>
  );
}
