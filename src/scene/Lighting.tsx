/**
 * Hemisphere + moon + warm rim lights, ported from design-3d/src/scene.js
 * `buildLights`. The moon casts one static shadow map (frozen after the first
 * frame on medium/low quality, per the plan's performance budget).
 */
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Color, Vector3, type DirectionalLight, type HemisphereLight } from 'three';
import { dayBlend } from '../state/sceneSettings';
import type { QualityProfile } from './quality';
import { useSceneClockRef } from './useSceneClock';

const WARM = new Color('#ff9a55');
const GOLD = new Color('#ffc247');
// Night (moon) vs day (high desert sun) values, crossfaded by dayBlend.
const MOON_COL = new Color('#b4c8ff');
const SUN_COL = new Color('#ffdcae');
const MOON_POS = new Vector3(-60, 90, 40);
// Day: a low late-morning sun from the south-east (+x east, +z south), about
// 24 degrees up, so every plant, tank and well head throws a long soft shadow
// across the field toward the north-west.
const SUN_POS = new Vector3(118, 62, 92);
const HEMI_SKY_NIGHT = new Color('#7f9fd6');
const HEMI_SKY_DAY = new Color('#a9c6ea');
const HEMI_GND_NIGHT = new Color('#3a2716');
const HEMI_GND_DAY = new Color('#9a7b55');

export function Lighting({ quality }: { quality: QualityProfile }) {
  const sceneClock = useSceneClockRef();
  const moonRef = useRef<DirectionalLight>(null);
  const rimRef = useRef<DirectionalLight>(null);
  const hemiRef = useRef<HemisphereLight>(null);
  const lastDay = useRef(-1);

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
    const day = dayBlend.value;
    if (rimRef.current) rimRef.current.intensity = (1.6 + grade * 1.0) * (1 - 0.8 * day);
    const moon = moonRef.current;
    if (moon) {
      moon.color.copy(MOON_COL).lerp(SUN_COL, day);
      moon.intensity = 2.2 + day * 1.5;
      moon.position.copy(MOON_POS).lerp(SUN_POS, day);
      // The shadow map is frozen on lower tiers; refresh it while the light moves.
      if (day !== lastDay.current) {
        // The low day sun stretches shadows, so the shadow frustum covers the whole field by day.
        const cam = moon.shadow.camera;
        const k = 1 + 0.45 * day;
        cam.left = -45 * k;
        cam.right = 45 * k;
        cam.top = 50 * k;
        cam.bottom = -50 * k;
        cam.far = 260 + 70 * day;
        cam.updateProjectionMatrix();
        moon.shadow.radius = 1 + 3 * day;
        moon.shadow.needsUpdate = true;
        lastDay.current = day;
      }
    }
    const hemi = hemiRef.current;
    if (hemi) {
      hemi.color.copy(HEMI_SKY_NIGHT).lerp(HEMI_SKY_DAY, day);
      hemi.groundColor.copy(HEMI_GND_NIGHT).lerp(HEMI_GND_DAY, day);
      // Cool sky fill against the warm key, a little lower than before so shadows keep depth.
      hemi.intensity = 1.2 - day * 0.25;
    }
  });

  return (
    <>
      <hemisphereLight ref={hemiRef} args={['#7f9fd6', '#3a2716', 1.5]} />
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
