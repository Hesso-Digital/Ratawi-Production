/**
 * Day finish for lit materials: as the scene crossfades to day, every patched
 * material blends part way toward a mid steel grey (keeping its baked AO,
 * normal map and shading), stays semi metallic with a satin roughness, and
 * gains a warm sun rim, so the plants read darker than the sunlit sand. At night
 * the original PBR (polished steel, paint, concrete) is untouched.
 *
 * One shared uniform drives every patched material, so the crossfade costs
 * nothing per material. `clayUniform.value` is written from dayBlend each
 * frame by <SceneLook />.
 */
import { Color, type Material, type MeshStandardMaterial } from 'three';

export const clayUniform = { value: 0 };
/** Day tone: a mid steel grey with a touch of warmth, darker than the sunlit sand so plants stand out. */
export const clayColor = { value: new Color('#7f8389') };
/** Warm sun rim on silhouettes by day (late-morning light from the south-east). */
export const rimColor = { value: new Color('#ffe4bf') };

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
    shader.uniforms.uRimColor = rimColor;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uClay;\nuniform float uClayStrength;\nuniform vec3 uClayColor;\nuniform vec3 uRimColor;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          float k = uClay * uClayStrength;
          float l = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
          // Keep half the original paint and steel so tanks, piping and decks read apart.
          diffuseColor.rgb = mix(diffuseColor.rgb, uClayColor * (0.72 + 0.5 * l), k * 0.62);
        }`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.42, uClay * uClayStrength);',
      )
      .replace(
        '#include <metalnessmap_fragment>',
        '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 0.45, uClay * uClayStrength);',
      )
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
        {
          // Day only: a warm fresnel rim so edges catch the low sun against the sand.
          float rim = pow(1.0 - saturate(dot(geometryNormal, geometryViewDir)), 3.0);
          reflectedLight.indirectDiffuse += uRimColor * rim * 0.55 * uClay * uClayStrength;
        }`,
      );
  };
  const prevKey = m.customProgramCacheKey?.bind(m);
  m.customProgramCacheKey = () => `${prevKey ? prevKey() : ''}|clay2`;
  m.needsUpdate = true;
  return m;
}
