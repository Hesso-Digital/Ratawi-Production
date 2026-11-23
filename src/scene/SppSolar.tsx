/**
 * SPP (solar project): a dotted blue area at the side of the concession
 * (translucent blue fill + dotted blue outline) with tilted panel rows.
 * The footprint comes from field.ts's SPP polygon. Materials are unlit so the
 * area stays clearly blue in both night and day lighting.
 */
import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color } from 'three';
import { dayBlend } from '../state/sceneSettings';
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  InstancedMesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  ShapeUtils,
  Vector2,
} from 'three';
import { SPP_WORLD, heightAt, inPolygon, polygonBounds } from './world';

const SPP_BLUE = '#3f8cff';
const SPP_BLUE_FILL = '#1a5fd4';
/** Day (concept 04): navy dashes on the sand. */
const SPP_NAVY = new Color('#1f2f6e');
const SPP_BLUE_C = new Color(SPP_BLUE);
const dummy = new Object3D();

function outlineDots() {
  const closed = [...SPP_WORLD, SPP_WORLD[0]];
  const dots: Array<{ x: number; z: number; angle: number }> = [];
  for (let e = 0; e < SPP_WORLD.length; e++) {
    const [ax, az] = closed[e];
    const [bx, bz] = closed[e + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const angle = Math.atan2(bz - az, bx - ax);
    for (let s = 0; s < len; s += 0.7) {
      const t = s / len;
      dots.push({ x: ax + (bx - ax) * t, z: az + (bz - az) * t, angle });
    }
  }
  return dots;
}

function panelRows() {
  const { minX, maxX, minZ, maxZ } = polygonBounds(SPP_WORLD);
  const rows: Array<[number, number]> = [];
  for (let z = minZ + 0.5; z < maxZ - 0.5; z += 2.2) {
    for (let x = minX + 1; x < maxX - 1; x += 3.4) {
      if (inPolygon(x, z, SPP_WORLD) && inPolygon(x + 3.2, z, SPP_WORLD) && inPolygon(x, z + 0.9, SPP_WORLD)) {
        rows.push([x + 1.6, z]);
      }
    }
  }
  return rows;
}

/** Ground-hugging fill so the SPP reads as a blue area, not only an outline. */
function areaGeometry() {
  const pts = SPP_WORLD.map(([x, z]) => new Vector2(x, z));
  const faces = ShapeUtils.triangulateShape(pts, []);
  const geo = new BufferGeometry();
  const pos = new Float32Array(pts.length * 3);
  pts.forEach((p, i) => {
    pos[i * 3] = p.x;
    pos[i * 3 + 1] = heightAt(p.x, p.y) + 0.05;
    pos[i * 3 + 2] = p.y;
  });
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setIndex(faces.flat());
  geo.computeVertexNormals();
  return geo;
}

export function SppSolar() {
  const dots = useMemo(() => outlineDots(), []);
  const rows = useMemo(() => panelRows(), []);
  const fillGeo = useMemo(() => areaGeometry(), []);

  const fillMesh = useMemo(
    () => (
      <mesh geometry={fillGeo} renderOrder={1} name="spp-fill">
        <meshBasicMaterial
          color={SPP_BLUE_FILL}
          transparent
          opacity={0.38}
          depthWrite={false}
          side={DoubleSide}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>
    ),
    [fillGeo],
  );

  const dotMesh = useMemo(() => {
    const mesh = new InstancedMesh(
      new BoxGeometry(0.55, 0.12, 0.22),
      // Unlit mid-blue (no HDR boost) so the dashes stay blue instead of blooming to white.
      new MeshBasicMaterial({ color: SPP_BLUE }),
      Math.max(1, dots.length),
    );
    dots.forEach((d, i) => {
      dummy.position.set(d.x, heightAt(d.x, d.z) + 0.14, d.z);
      dummy.rotation.set(0, -d.angle, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.count = dots.length;
    mesh.renderOrder = 2;
    return mesh;
  }, [dots]);

  // Glass modules in brushed aluminium frames on two legs (concept 01/05 panel tables).
  const { panelMesh, frameMesh, legMesh } = useMemo(() => {
    const n = Math.max(1, rows.length);
    const panelMesh = new InstancedMesh(
      new BoxGeometry(1.78, 0.03, 0.84),
      new MeshStandardMaterial({ color: '#0c1d3d', metalness: 0.35, roughness: 0.12, emissive: '#06122a', emissiveIntensity: 0.5, envMapIntensity: 1.4 }),
      n,
    );
    const frameMesh = new InstancedMesh(
      new BoxGeometry(1.86, 0.045, 0.92),
      new MeshStandardMaterial({ color: '#b9c0c8', metalness: 0.9, roughness: 0.3 }),
      n,
    );
    const legMesh = new InstancedMesh(new BoxGeometry(0.05, 0.42, 0.05), new MeshStandardMaterial({ color: '#8a9199', metalness: 0.8, roughness: 0.4 }), n * 2);
    panelMesh.castShadow = panelMesh.receiveShadow = true;
    frameMesh.castShadow = true;
    rows.forEach(([x, z], i) => {
      const y = heightAt(x, z);
      dummy.position.set(x, y + 0.38, z);
      dummy.rotation.set(-0.45, 0, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      frameMesh.setMatrixAt(i, dummy.matrix);
      dummy.translateY(0.012);
      dummy.updateMatrix();
      panelMesh.setMatrixAt(i, dummy.matrix);
      for (const [k, dx] of [[0, -0.7], [1, 0.7]] as const) {
        dummy.position.set(x + dx, y + 0.21, z);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        legMesh.setMatrixAt(i * 2 + k, dummy.matrix);
      }
    });
    panelMesh.count = frameMesh.count = rows.length;
    legMesh.count = rows.length * 2;
    return { panelMesh, frameMesh, legMesh };
  }, [rows]);

  useFrame(() => {
    const day = dayBlend.value;
    (dotMesh.material as MeshBasicMaterial).color.copy(SPP_BLUE_C).lerp(SPP_NAVY, day);
  });

  return (
    <group>
      {fillMesh}
      <primitive object={dotMesh} />
      <primitive object={frameMesh} />
      <primitive object={panelMesh} />
      <primitive object={legMesh} />
    </group>
  );
}
