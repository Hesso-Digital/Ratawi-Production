/**
 * SPP (solar project): a dotted blue outline + tilted panel rows, ported from
 * design-3d/src/scene.js `buildSPP`. The footprint comes from field.ts's SPP
 * polygon (open input #1 also covers this footprint's accuracy).
 */
import { useMemo } from 'react';
import { BoxGeometry, InstancedMesh, MeshBasicMaterial, MeshStandardMaterial, Object3D } from 'three';
import { SPP_WORLD, heightAt, inPolygon, polygonBounds } from './world';
import { hdr } from './shaders/materials';

const SPP_BLUE = '#3f8cff';
const dummy = new Object3D();

function outlineDots() {
  const closed = [...SPP_WORLD, SPP_WORLD[0]];
  const dots: Array<{ x: number; z: number; angle: number }> = [];
  for (let e = 0; e < SPP_WORLD.length; e++) {
    const [ax, az] = closed[e];
    const [bx, bz] = closed[e + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const angle = Math.atan2(bz - az, bx - ax);
    for (let s = 0; s < len; s += 0.75) {
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

export function SppSolar() {
  const dots = useMemo(() => outlineDots(), []);
  const rows = useMemo(() => panelRows(), []);

  const dotMesh = useMemo(() => {
    const mesh = new InstancedMesh(
      new BoxGeometry(0.42, 0.08, 0.16),
      new MeshBasicMaterial({ color: hdr(SPP_BLUE, 5) }),
      Math.max(1, dots.length),
    );
    dots.forEach((d, i) => {
      dummy.position.set(d.x, heightAt(d.x, d.z) + 0.12, d.z);
      dummy.rotation.set(0, -d.angle, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.count = dots.length;
    return mesh;
  }, [dots]);

  const panelMesh = useMemo(() => {
    const mesh = new InstancedMesh(
      new BoxGeometry(1.85, 0.04, 0.9),
      new MeshStandardMaterial({
        color: '#0f2346',
        metalness: 0.6,
        roughness: 0.22,
        emissive: '#06122a',
        emissiveIntensity: 0.6,
      }),
      Math.max(1, rows.length),
    );
    mesh.castShadow = mesh.receiveShadow = true;
    rows.forEach(([x, z], i) => {
      dummy.position.set(x, heightAt(x, z) + 0.35, z);
      dummy.rotation.set(-0.45, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.count = rows.length;
    return mesh;
  }, [rows]);

  return (
    <group>
      <primitive object={dotMesh} />
      <primitive object={panelMesh} />
    </group>
  );
}
