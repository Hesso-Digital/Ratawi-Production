/**
 * Dune heightfield terrain, ported from design-3d/src/scene.js `buildTerrain`.
 * Segment count comes from the active quality profile (plan section 8: medium
 * keeps this cheap enough for a venue PC).
 */
import { useMemo } from 'react';
import { PlaneGeometry, MeshStandardMaterial, Vector3 } from 'three';
import { heightAt } from './world';
import { createGrainTexture, createTerrainColorTexture } from './textures';
import type { QualityProfile } from './quality';

const SIZE = 420;

export function FieldTerrain({ quality }: { quality: QualityProfile }) {
  const { geometry, material } = useMemo(() => {
    const seg = quality.terrainSegments;
    const geo = new PlaneGeometry(SIZE, SIZE, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const v = new Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      pos.setY(i, heightAt(v.x, v.z));
    }
    geo.computeVertexNormals();

    const mat = new MeshStandardMaterial({
      map: createTerrainColorTexture(),
      bumpMap: createGrainTexture(),
      bumpScale: 0.12,
      roughness: 0.96,
      metalness: 0,
      color: '#d9b994',
    });
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWp;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWp;')
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
        {
          float dist = length(vWp.xz);
          float fade = smoothstep(190.0, 30.0, dist);
          vec2 g = abs(fract(vWp.xz / 10.0) - 0.5) * 2.0;
          vec2 gw = fwidth(vWp.xz / 10.0) * 2.0;
          float grid = max(1.0 - smoothstep(0.0, gw.x * 1.2, 1.0 - g.x), 1.0 - smoothstep(0.0, gw.y * 1.2, 1.0 - g.y));
          totalEmissiveRadiance += vec3(0.12, 0.2, 0.3) * grid * 0.05 * fade;
        }`,
        );
    };
    return { geometry: geo, material: mat };
    // Rebuild only when the terrain resolution changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quality.terrainSegments]);

  return <mesh geometry={geometry} material={material} receiveShadow />;
}
