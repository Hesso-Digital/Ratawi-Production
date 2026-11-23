/**
 * EffectComposer → Bloom (mipmap) → ToneMapping (ACES), ported from
 * design-3d/src/scene.js's UnrealBloomPass + OutputPass. Bloom strength
 * rises with the milestone gold grade and the short post-milestone pulse.
 * Disabled entirely on the "low" quality profile (plan section 8).
 */
import { Bloom, EffectComposer, ToneMapping } from '@react-three/postprocessing';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { BloomEffect } from 'postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { useSceneClockRef } from './useSceneClock';

export function PostFX() {
  const sceneClock = useSceneClockRef();
  const bloomRef = useRef<BloomEffect>(null);

  useFrame(() => {
    const bloom = bloomRef.current;
    if (!bloom) return;
    const { gold, bloomPulse } = sceneClock.current;
    bloom.intensity = 0.7 + gold * 0.6 + bloomPulse * 1.4;
  });

  return (
    <EffectComposer multisampling={0}>
      <Bloom ref={bloomRef} luminanceThreshold={1} mipmapBlur intensity={0.7} radius={0.5} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}
