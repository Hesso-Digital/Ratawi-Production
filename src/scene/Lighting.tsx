/**
 * Hemisphere + moon + warm rim lights, ported from design-3d/src/scene.js
 * `buildLights`. The moon casts one static shadow map (frozen after the first
 * frame on medium/low quality, per the plan's performance budget).
 */
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Color, type DirectionalLight } from 'three';
import type { QualityProfile } from './quality';
import { useSceneClockRef } from './useSceneClock';

const WARM = new Color('#ff9a55');
const GOLD = new Color('#ffc247');

export function Lighting({ quality }: { quality: QualityProfile }) {
  const sceneClock = useSceneClockRef();
  const moonRef = useRef<DirectionalLight>(null);
  const rimRef = useRef<DirectionalLight>(null);

  useEffect(() => {
    const moon = moonRef.current;
    if (!moon) return;
    moon.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
    const cam = moon.shadow.camera;
    cam.left = -45;
    cam.right = 45;
    cam.top = 50;
    cam.bottom = -50;
    cam.near = 10;
    cam.far = 260;
    moon.shadow.bias = -0.0004;
    moon.shadow.normalBias = 0.03;
    cam.updateProjectionMatrix();
    // Freeze the shadow map after the first render on lower quality tiers: the
    // sun/moon never moves, so this avoids re-rendering the shadow pass per frame.
    if (!quality.microAnimations) moon.shadow.autoUpdate = false;
  }, [quality.shadowMapSize, quality.microAnimations]);

  useFrame(() => {
    const grade = sceneClock.current.gold;
    rimRef.current?.color.copy(WARM).lerp(GOLD, grade);
    if (rimRef.current) rimRef.current.intensity = 1.6 + grade * 1.0;
  });

  return (
    <>
      <hemisphereLight args={['#7f9fd6', '#3a2716', 1.5]} />
      <directionalLight
        ref={moonRef}
        color="#b4c8ff"
        intensity={2.4}
        position={[-60, 90, 40]}
        castShadow={quality.shadows}
      />
      <directionalLight ref={rimRef} color="#ff9a55" intensity={1.6} position={[110, 18, 60]} />
    </>
  );
}
