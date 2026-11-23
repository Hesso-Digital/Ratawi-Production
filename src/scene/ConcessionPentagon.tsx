/**
 * Ratawi concession boundary: a red outline (unlit ground core so it stays
 * legible in day lighting, plus a glowing wall and posts for night) and corner
 * posts, ported from design-3d/src/scene.js `buildBoundary`. Takes any vertex
 * list (today field.ts's 8-vertex chamfered shape; swap in the official vector
 * without touching this component).
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
import { dayBlend, sceneSettings } from '../state/sceneSettings';
import { AdditiveBlending, Color } from 'three';
import { createBoundaryWallMaterial, hdr } from './shaders/materials';
import { createGlowSprite } from './textures';

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

function tubeFromPoints(points: Vector3[], radius: number, color: string, opacity = 1, boost = 1) {
  const curve = new CurvePath<Vector3>();
  for (let i = 0; i < points.length - 1; i++) curve.add(new LineCurve3(points[i], points[i + 1]));
  const geo = new TubeGeometry(curve, points.length * 2, radius, 8, false);
  const mat = new MeshBasicMaterial({
    color: boost === 1 ? color : hdr(color, boost),
    transparent: opacity < 1,
    opacity,
    depthWrite: opacity >= 1,
  });
  return new Mesh(geo, mat);
}

export function ConcessionPentagon() {
  const wallMatRef = useRef<ShaderMaterial | null>(null);

  const { wallGeometry, coreTube, groundTube, topTube, posts } = useMemo(() => {
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
      // Unlit solid core: stays clearly red on a bright day sky, not only as night bloom.
      coreTube: tubeFromPoints(groundPts, 0.16, '#c41022', 1, 1),
      groundTube: tubeFromPoints(groundPts, 0.11, RED, 1, 2.2),
      topTube: tubeFromPoints(topPts, 0.025, RED, 0.55, 1.2),
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

  // Night: glowing red wall (concept 01). Day: a thin crisp red line on the sand (concept 04).
  const glowColor = useMemo(() => hdr(RED, 1.4), []);
  const groundNight = useMemo(() => hdr(RED, 2.2), []);
  const groundDay = useMemo(() => new Color('#c8202c'), []);
  const postGlow = useMemo(
    () =>
      new MeshBasicMaterial({ map: createGlowSprite(), color: hdr(RED, 0.9), transparent: true, opacity: 0.55, depthWrite: false, blending: AdditiveBlending, toneMapped: false }),
    [],
  );
  const capMaterial = useMemo(() => new MeshBasicMaterial({ color: hdr(RED, 4), toneMapped: false }), []);
  useFrame((_, delta) => {
    // Flows off freezes the boundary shimmer; the red wall stays.
    if (sceneSettings.get().flows) wallMaterial.uniforms.uTime.value += delta;
    const day = dayBlend.value;
    (wallMaterial.uniforms.uColor.value as Color).copy(glowColor).multiplyScalar(1 - 0.92 * day);
    const top = topTube.material as MeshBasicMaterial;
    top.opacity = 0.55 * (1 - day);
    top.visible = day < 0.98;
    (groundTube.material as MeshBasicMaterial).color.copy(groundNight).lerp(groundDay, day);
    coreTube.visible = day < 0.5;
    postGlow.opacity = 0.55 * (1 - day);
    capMaterial.color.set(RED).multiplyScalar(4 - 3 * day);
  });

  return (
    <group>
      <mesh geometry={wallGeometry} material={wallMaterial} />
      <primitive object={coreTube} />
      <primitive object={groundTube} />
      <primitive object={topTube} />
      {posts.map((p, i) => (
        <group key={i} position={[p.x, p.y, p.z]}>
          <mesh position={[0, (WALL_HEIGHT * 1.25) / 2, 0]}>
            <cylinderGeometry args={[0.07, 0.07, WALL_HEIGHT * 1.25, 8]} />
            <meshBasicMaterial color="#c41022" />
          </mesh>
          {/* Emissive cap + ground glow instead of eight real point lights (each one cost every lit pixel). */}
          <mesh position={[0, WALL_HEIGHT * 1.27, 0]} material={capMaterial}>
            <sphereGeometry args={[0.13, 12, 8]} />
          </mesh>
          <mesh position={[0, 0.06, 0]} rotation-x={-Math.PI / 2} material={postGlow} renderOrder={2}>
            <circleGeometry args={[2.2, 24]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
