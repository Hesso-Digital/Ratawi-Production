/**
 * Ground heightfield: flat compacted field inside the concession, blending
 * into the real Copernicus DEM trend outside it (see world.ts heightAt).
 * Vertex colours follow ESA WorldCover: compacted grey-tan pad ground in the
 * field, warm sand / gravel desert beyond, darker wet ground and green-brown
 * farmland toward the northern marshes. Originally ported from
 * design-3d/src/scene.js `buildTerrain`.
 * Segment count comes from the active quality profile (plan section 8: medium
 * keeps this cheap enough for a venue PC).
 */
import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferAttribute, Color, PlaneGeometry, MeshStandardMaterial, Vector3 } from 'three';
import { groundCoverAt, heightAt, outsideFieldBlend } from './world';
import { dayBlend } from '../state/sceneSettings';

const FIELD_GROUND = new Color('#cdb79c');
const SAND = new Color('#e3c59a');
const GRAVEL = new Color('#c9b495');
const WET = new Color('#4f5448');
const FARM = new Color('#7d7a52');
import { createGrainTexture, createTerrainColorTexture } from './textures';
import type { QualityProfile } from './quality';

const SIZE = 420;

export function FieldTerrain({ quality }: { quality: QualityProfile }) {
  const { geometry, material, uDay } = useMemo(() => {
    const seg = quality.terrainSegments;
    const geo = new PlaneGeometry(SIZE, SIZE, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const v = new Vector3();
    const colors = new Float32Array(pos.count * 3);
    const c = new Color();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const y = heightAt(v.x, v.z);
      pos.setY(i, y);
      const out = outsideFieldBlend(v.x, v.z);
      const { wet, green } = groundCoverAt(v.x, v.z);
      // Higher ground to the south-west is Dibdibba gravel; lower ground is finer sand.
      c.copy(SAND).lerp(GRAVEL, Math.min(1, Math.max(0, y / 8)));
      c.lerp(FARM, Math.min(1, green * 1.2));
      c.lerp(WET, Math.min(1, wet * 1.1));
      c.lerp(FIELD_GROUND, 1 - out);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const uDay = { value: dayBlend.value };

    const mat = new MeshStandardMaterial({
      map: createTerrainColorTexture(),
      bumpMap: createGrainTexture(),
      bumpScale: 0.12,
      roughness: 0.96,
      metalness: 0,
      color: '#ffffff',
      vertexColors: true,
    });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uDay = uDay;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWp;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWp;\nuniform float uDay;')
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
        {
          // Night (concepts 01-03): deep, slightly cool umber ground so the light carries the scene.
          vec3 night = diffuseColor.rgb * vec3(0.21, 0.195, 0.2);
          // Day (concept 04): warm off-white sand clay; the texture contrast is softened so the relief reads through light and shadow.
          float l = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
          vec3 clay = mix(vec3(0.80, 0.70, 0.56), vec3(0.88, 0.80, 0.67), smoothstep(0.55, 0.85, l)) * (0.86 + 0.22 * l);
          float field = smoothstep(14.0, 0.0, length(vWp.xz) - 34.0);
          clay *= mix(1.0, 1.04, field);
          diffuseColor.rgb = mix(night, mix(diffuseColor.rgb, clay, 0.78), uDay);
        }`,
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
        {
          float dist = length(vWp.xz);
          float fade = smoothstep(190.0, 30.0, dist);
          vec2 g = abs(fract(vWp.xz / 10.0) - 0.5) * 2.0;
          vec2 gw = fwidth(vWp.xz / 10.0) * 2.0;
          float grid = max(1.0 - smoothstep(0.0, gw.x * 1.2, 1.0 - g.x), 1.0 - smoothstep(0.0, gw.y * 1.2, 1.0 - g.y));
          totalEmissiveRadiance += vec3(0.12, 0.2, 0.3) * grid * 0.035 * fade * (1.0 - uDay);
        }`,
        );
    };
    return { geometry: geo, material: mat, uDay };
    // Rebuild only when the terrain resolution changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quality.terrainSegments]);

  useFrame(() => {
    uDay.value = dayBlend.value;
  });

  return <mesh geometry={geometry} material={material} receiveShadow />;
}
