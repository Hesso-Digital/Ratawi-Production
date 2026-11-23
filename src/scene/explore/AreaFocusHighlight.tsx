/**
 * Subtle ground plate, glowing outline and a local light that lift the
 * active viewpoint (keys 1–8) on the field. Reads exploreStore.areaId so it
 * stays in sync with the camera fly-to. Does not edit well / facility meshes;
 * flow-line dimming stays in focusGain().
 */
import { Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import gsap from 'gsap';
import { useEffect, useMemo, useRef } from 'react';
import { DoubleSide, EllipseCurve, Shape, ShapeGeometry, type Group, type MeshBasicMaterial } from 'three';
import { dayBlend, useTimeOfDay } from '../../state/sceneSettings';
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

function pathRibbon(points: readonly Vec2[], y: number): [number, number, number][] {
  // A thin outline that follows the export corridor (centerline, closed as a long loop is wrong).
  return points.map((p) => [p[0], y, p[1]] as [number, number, number]);
}

function shapeFromPoly(points: readonly Vec2[]): Shape {
  const s = new Shape();
  s.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) s.lineTo(points[i][0], points[i][1]);
  s.closePath();
  return s;
}

function shapeFromEllipse(cx: number, cz: number, rx: number, rz: number): Shape {
  const s = new Shape();
  s.absellipse(cx, cz, rx, rz, 0, Math.PI * 2, false, 0);
  return s;
}

function Plate({ foot, opacity }: { foot: AreaFootprint; opacity: number }) {
  const geometry = useMemo(() => {
    if (foot.kind === 'polygon') return new ShapeGeometry(shapeFromPoly(foot.points));
    if (foot.kind === 'ellipse') return new ShapeGeometry(shapeFromEllipse(foot.cx, foot.cz, foot.rx, foot.rz));
    if (foot.kind === 'path' && foot.points.length >= 2) {
      // A simple stadium around the corridor: offset is approximated as an ellipse along the bbox.
      const xs = foot.points.map((p) => p[0]);
      const zs = foot.points.map((p) => p[1]);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
      const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
      const rx = (Math.max(...xs) - Math.min(...xs)) / 2 + foot.width;
      const rz = (Math.max(...zs) - Math.min(...zs)) / 2 + foot.width;
      return new ShapeGeometry(shapeFromEllipse(cx, cz, rx, rz));
    }
    return new ShapeGeometry(new Shape());
  }, [foot]);

  const mat = useRef<MeshBasicMaterial>(null);
  useFrame(() => {
    if (!mat.current) return;
    const day = dayBlend.value;
    mat.current.color.setRGB(0.08 + 0.05 * day, 0.55 - 0.15 * day, 0.72 - 0.25 * day);
    mat.current.opacity = opacity * (0.16 + 0.1 * (1 - day));
  });

  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, foot.y, 0]} renderOrder={2}>
      <meshBasicMaterial ref={mat} transparent depthWrite={false} side={DoubleSide} toneMapped={false} />
    </mesh>
  );
}

function Outline({ foot, y }: { foot: AreaFootprint; y: number }) {
  const points = useMemo(() => {
    if (foot.kind === 'polygon') return polyPoints(foot.points, y);
    if (foot.kind === 'ellipse') return ringPoints(foot.cx, foot.cz, foot.rx, foot.rz, y);
    return pathRibbon(foot.points, y);
  }, [foot, y]);
  const color = dayBlend.value > 0.5 ? '#0d5c6d' : '#4dd0e1';
  return <Line points={points} color={color} lineWidth={2} transparent opacity={0.95} depthWrite={false} />;
}

export function AreaFocusHighlight() {
  const { areaId } = useExploreState();
  useTimeOfDay();
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
    g.position.y = v * 0.55;
    g.scale.setScalar(0.96 + 0.04 * v);
  });

  if (!foot) return null;

  const lightPos: [number, number, number] =
    foot.kind === 'ellipse'
      ? [foot.cx, foot.y + 14, foot.cz]
      : foot.kind === 'polygon'
        ? [
            foot.points.reduce((s, p) => s + p[0], 0) / foot.points.length,
            foot.y + 16,
            foot.points.reduce((s, p) => s + p[1], 0) / foot.points.length,
          ]
        : [
            foot.points[Math.floor(foot.points.length / 2)][0],
            foot.y + 12,
            foot.points[Math.floor(foot.points.length / 2)][1],
          ];

  const day = dayBlend.value;
  const lightIntensity = foot.id === 'aerial' ? 0.4 + 0.2 * day : 1.6 + 0.6 * (1 - day);

  return (
    <group ref={group}>
      <Plate foot={foot} opacity={foot.id === 'aerial' ? 0.55 : 1} />
      <Outline foot={foot} y={foot.y + 0.08} />
      <pointLight
        position={lightPos}
        intensity={lightIntensity}
        distance={foot.id === 'aerial' ? 120 : 46}
        color={day > 0.5 ? '#fff4d8' : '#7ee7ff'}
        decay={2}
      />
    </group>
  );
}
