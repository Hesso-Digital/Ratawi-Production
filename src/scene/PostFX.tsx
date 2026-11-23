/**
 * EffectComposer → Bloom (mipmap) → ToneMapping (ACES), ported from
 * design-3d/src/scene.js's UnrealBloomPass + OutputPass. Bloom strength
 * rises with the milestone gold grade and the short post-milestone pulse.
 * Disabled entirely on the "low" quality profile (plan section 8).
 */
import { Bloom, EffectComposer, ToneMapping } from '@react-three/postprocessing';
import { useFrame, useThree } from '@react-three/fiber';
import { memo, useEffect, useRef } from 'react';
import type { BloomEffect } from 'postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { useSceneClockRef } from './useSceneClock';
import { dayBlend } from '../state/sceneSettings';

export const PostFX = memo(function PostFX() {
  const sceneClock = useSceneClockRef();
  const bloomRef = useRef<BloomEffect | null>(null);
  // A callback ref: the composer wrapper serialises its props, and a populated object ref would not serialise.
  const setBloom = (effect: BloomEffect | null) => {
    bloomRef.current = effect;
  };
  const gl = useThree((state) => state.gl);

  // The composer turns autoClear off; without restoring it, dropping to the low profile would smear frames together.
  useEffect(
    () => () => {
      gl.autoClear = true;
    },
    [gl],
  );

  useFrame(() => {
    const bloom = bloomRef.current;
    if (!bloom) return;
    const { gold, bloomPulse } = sceneClock.current;
    // Day keeps a tighter, softer glow so fixtures read as lit lamps rather than haze.
    bloom.intensity = (0.7 + gold * 0.6 + bloomPulse * 1.4) * (1 - 0.55 * dayBlend.value);
  });

  return (
    <EffectComposer multisampling={0}>
      <Bloom ref={setBloom} luminanceThreshold={1} mipmapBlur intensity={0.7} radius={0.5} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
});
