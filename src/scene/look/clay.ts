/**
 * Day "sand model" finish for lit materials: as the scene crossfades to day,
 * every patched material blends toward a warm off-white clay (keeping its
 * baked AO, normal map and shading), loses most of its metalness and gets a
 * soft satin roughness, like the architectural model in concept 04. At night
 * the original PBR (polished steel, paint, concrete) is untouched.
 *
 * One shared uniform drives every patched material, so the crossfade costs
 * nothing per material. `clayUniform.value` is written from dayBlend each
 * frame by <SceneLook />.
 */
import { Color, type Material, type MeshStandardMaterial } from 'three';

export const clayUniform = { value: 0 };
export const clayColor = { value: new Color('#e9e2d6') };

const PATCHED = Symbol('ratawiClay');

export function applyClay(material: Material, opts: { strength?: number; tint?: Color } = {}): Material {
  const m = material as MeshStandardMaterial & { [PATCHED]?: boolean };
  if (!('roughness' in m) || m[PATCHED]) return m;
  m[PATCHED] = true;
  const strength = { value: opts.strength ?? 1 };
  const tint = { value: opts.tint ?? clayColor.value };
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (shader, renderer) => {
    prev?.call(m, shader, renderer);
    shader.uniforms.uClay = clayUniform;
    shader.uniforms.uClayStrength = strength;
    shader.uniforms.uClayColor = tint;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uClay;\nuniform float uClayStrength;\nuniform vec3 uClayColor;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          float k = uClay * uClayStrength;
          float l = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
          diffuseColor.rgb = mix(diffuseColor.rgb, uClayColor * (0.9 + 0.18 * l), k);
        }`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.66, uClay * uClayStrength);',
      )
      .replace(
        '#include <metalnessmap_fragment>',
        '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 0.04, uClay * uClayStrength);',
      );
  };
  const prevKey = m.customProgramCacheKey?.bind(m);
  m.customProgramCacheKey = () => `${prevKey ? prevKey() : ''}|clay`;
  m.needsUpdate = true;
  return m;
}
