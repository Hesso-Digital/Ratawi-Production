/**
 * EffectComposer → Bloom (mipmap) → Vignette → film grain → SMAA → ToneMapping
 * (ACES). Bloom strength rises with the milestone gold grade and the short
 * post-milestone pulse. Per mode: night is cinematic (stronger bloom, deeper
 * vignette, a touch of grain), day is clean (soft bloom only on lamps, light
 * vignette, almost no grain) for the sand-model look. Exposure per mode is set
 * in SkyAndFog.
 *
 * Disabled entirely on the "low" quality profile. Bloom runs at half
 * resolution, and SMAA is skipped when the canvas is already dense (4K or a
 * high pixel ratio), so big screens keep their frame rate.
 */
import { Bloom, EffectComposer, Noise, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing';
import { useFrame, useThree } from '@react-three/fiber';
import { memo, useEffect, useRef } from 'react';
import type { BloomEffect, NoiseEffect, VignetteEffect } from 'postprocessing';
import { BlendFunction, ToneMappingMode } from 'postprocessing';
import { useSceneClockRef } from './useSceneClock';
import { dayBlend } from '../state/sceneSettings';
import type { QualityProfile } from './quality';

/** Canvas pixel count above which SMAA is skipped (the pixels are already small). */
const SMAA_PIXEL_LIMIT = 4_200_000;

export const PostFX = memo(function PostFX({ quality }: { quality: QualityProfile }) {
  const sceneClock = useSceneClockRef();
  const bloomRef = useRef<BloomEffect | null>(null);
  const vignetteRef = useRef<VignetteEffect | null>(null);
  const noiseRef = useRef<NoiseEffect | null>(null);
  // Callback refs: the composer wrapper serialises its props, and a populated object ref would not serialise.
  const setBloom = (effect: BloomEffect | null) => {
    bloomRef.current = effect;
  };
  const setVignette = (effect: VignetteEffect | null) => {
    vignetteRef.current = effect;
  };
  const setNoise = (effect: NoiseEffect | null) => {
    noiseRef.current = effect;
  };
  const gl = useThree((state) => state.gl);
  const size = useThree((state) => state.size);
  const dpr = useThree((state) => state.viewport.dpr);
  const dense = size.width * size.height * dpr * dpr > SMAA_PIXEL_LIMIT;

  // The composer turns autoClear off; without restoring it, dropping to the low profile would smear frames together.
  useEffect(
    () => () => {
      gl.autoClear = true;
    },
    [gl],
  );

  useFrame(() => {
    const day = dayBlend.value;
    const bloom = bloomRef.current;
    if (bloom) {
      const { gold, bloomPulse } = sceneClock.current;
      bloom.intensity = (0.75 + gold * 0.5 + bloomPulse * 1.4) * (1 - 0.75 * day);
    }
    const v = vignetteRef.current;
    if (v) {
      v.darkness = 0.62 - 0.4 * day;
      v.offset = 0.28 + 0.1 * day;
    }
    const n = noiseRef.current;
    if (n) n.blendMode.opacity.value = 0.055 * (1 - 0.8 * day);
  });

  const bloom = <Bloom ref={setBloom} luminanceThreshold={1} luminanceSmoothing={0.2} mipmapBlur intensity={0.85} radius={0.62} resolutionScale={0.5} />;
  const vignette = <Vignette ref={setVignette} offset={0.28} darkness={0.62} eskil={false} />;
  const grain = <Noise ref={setNoise} premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={quality.id === 'high' ? 0.055 : 0.04} />;
  const tone = <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />;
  return dense ? (
    <EffectComposer multisampling={0}>
      {bloom}
      {vignette}
      {grain}
      {tone}
    </EffectComposer>
  ) : (
    <EffectComposer multisampling={0}>
      {bloom}
      {vignette}
      {grain}
      {tone}
      <SMAA />
    </EffectComposer>
  );
});
