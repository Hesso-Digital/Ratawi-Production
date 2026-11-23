/**
 * Ratawi concession boundary: a glowing extruded wall + a sharp ground tube +
 * corner posts, ported from design-3d/src/scene.js `buildBoundary`. Takes any
 * vertex list (today field.ts's 8-vertex chamfered shape; swap in the official
 * vector per open input #1 without touching this component).
 */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import {
  BufferGeometry,
  CurvePath,
  Float32BufferAttribute,
  LineCurve3,
  Mesh,
  MeshBasicMaterial,
  TubeGeometry,
  Vector3,
} from 'three';
import type { ShaderMaterial } from 'three';
import { CONCESSION_WORLD, heightAt, type Vec2 } from './world';
import { createBoundaryWallMaterial, hdr } from './shaders/materials';

const RED = '#ff2a36';
const WALL_HEIGHT = 2.4;

function densify(points: readonly Vec2[], lift: number) {
  const closed = [...points, points[0]];
  const out: Vector3[] = [];
  for (let e = 0; e < points.length; e++) {
    const [ax, az] = closed[e];
    const [bx, bz] = closed[e + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 1.0));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const x = ax + (bx - ax) * t;
      const z = az + (bz - az) * t;
      out.push(new Vector3(x, heightAt(x, z) + lift, z));
    }
  }
  out.push(out[0].clone());
  return out;
}

function tubeFromPoints(points: Vector3[], radius: number, color: string, opacity = 1) {
  const curve = new CurvePath<Vector3>();
  for (let i = 0; i < points.length - 1; i++) curve.add(new LineCurve3(points[i], points[i + 1]));
  const geo = new TubeGeometry(curve, points.length * 2, radius, 8, false);
  const mat = new MeshBasicMaterial({ color: hdr(color, opacity < 1 ? 1.2 : 3.6), transparent: opacity < 1, opacity });
  return new Mesh(geo, mat);
}

export function ConcessionPentagon() {
  const wallMatRef = useRef<ShaderMaterial | null>(null);

  const { wallGeometry, groundTube, topTube, posts } = useMemo(() => {
    const groundPts = densify(CONCESSION_WORLD, 0.07);
    const topPts = groundPts.map((v) => v.clone().setY(v.y + WALL_HEIGHT * 0.98));

    // Wall ribbon: a quad strip from ground height to WALL_HEIGHT along each edge.
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    let base = 0;
    const closed = [...CONCESSION_WORLD, CONCESSION_WORLD[0]];
    for (let e = 0; e < CONCESSION_WORLD.length; e++) {
      const [ax, az] = closed[e];
      const [bx, bz] = closed[e + 1];
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 1.0));
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        const x = ax + (bx - ax) * t;
        const z = az + (bz - az) * t;
        const y = heightAt(x, z);
        pos.push(x, y, z, x, y + WALL_HEIGHT, z);
        uv.push(0, 0, 0, 1);
        if (k < n) {
          const a = base + k * 2;
          idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
      }
      base += (n + 1) * 2;
    }
    const wallGeo = new BufferGeometry();
    wallGeo.setAttribute('position', new Float32BufferAttribute(pos, 3));
    wallGeo.setAttribute('uv', new Float32BufferAttribute(uv, 2));
    wallGeo.setIndex(idx);

    const posts = CONCESSION_WORLD.map(([x, z]) => {
      const y = heightAt(x, z);
      return { x, y, z };
    });

    return {
      wallGeometry: wallGeo,
      groundTube: tubeFromPoints(groundPts, 0.11, RED, 1),
      topTube: tubeFromPoints(topPts, 0.025, RED, 0.5),
      posts,
    };
    // Concession geometry is static for the session; rebuild only if it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const wallMaterial = useMemo(() => {
    const mat = createBoundaryWallMaterial(hdr(RED, 1.4));
    wallMatRef.current = mat;
    return mat;
  }, []);

  useFrame((_, delta) => {
    wallMaterial.uniforms.uTime.value += delta;
  });

  return (
    <group>
      <mesh geometry={wallGeometry} material={wallMaterial} />
      <primitive object={groundTube} />
      <primitive object={topTube} />
      {posts.map((p, i) => (
        <group key={i} position={[p.x, p.y, p.z]}>
          <mesh position={[0, (WALL_HEIGHT * 1.25) / 2, 0]}>
            <cylinderGeometry args={[0.09, 0.09, WALL_HEIGHT * 1.25, 8]} />
            <meshBasicMaterial color={hdr(RED, 4)} />
          </mesh>
          <pointLight color={RED} intensity={6} distance={10} position={[0, WALL_HEIGHT * 1.27, 0]} />
        </group>
      ))}
    </group>
  );
}
