/**
 * The 120 kbopd milestone: a gold ground shockwave + rising embers over
 * CPF-1, ported from design-3d/src/scene.js `buildCelebration` /
 * `updateCelebration`. Driven by the scene clock's data-driven `gold` grade,
 * not a hard-coded time (plan section 5's "gold rule").
 */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { BufferAttribute, BufferGeometry, Points, type Mesh } from 'three';
import { CPF_WORLD, heightAt } from './world';
import { createPointsMaterial, createShockwaveMaterial, hdr } from './shaders/materials';
import { createGlowSprite } from './textures';
import { useSceneClockRef } from './useSceneClock';
import { BEATS } from './ceremonyTimeline';
import type { QualityProfile } from './quality';

const GOLD = '#ffc247';

export function MilestoneShockwave({ quality }: { quality: QualityProfile }) {
  const sceneClock = useSceneClockRef();
  const waveRef = useRef<Mesh>(null);
  const emberRef = useRef<Points>(null);

  const [cx, cz] = CPF_WORLD;
  const groundY = heightAt(cx, cz) + 0.1;

  const waveMaterial = useMemo(() => createShockwaveMaterial(hdr(GOLD, 1.3)), []);

  const emberCount = Math.max(32, Math.round(420 * quality.particleScale));
  const { geometry, material, seeds } = useMemo(() => {
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(emberCount * 3), 3));
    geo.setAttribute('aColor', new BufferAttribute(new Float32Array(emberCount * 3), 3));
    geo.setAttribute('aSize', new BufferAttribute(new Float32Array(emberCount), 1));
    const seeds: Array<[number, number, number, number]> = [];
    let seed = 7;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (let i = 0; i < emberCount; i++) {
      const a = rand() * Math.PI * 2;
      const d = Math.sqrt(rand()) * 9;
      seeds.push([cx + Math.cos(a) * d * 1.3, cz + Math.sin(a) * d, rand(), 0.3 + rand() * 0.7]);
    }
    return { geometry: geo, material: createPointsMaterial(createGlowSprite()), seeds };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emberCount]);

  useFrame(({ clock }) => {
    const { t, gold, cueKind } = sceneClock.current;
    const since = cueKind === 'step2' ? t - BEATS.milestone : gold > 0 ? 999 : -999;
    const wave = waveRef.current?.material as typeof waveMaterial | undefined;
    if (wave) {
      wave.uniforms.uR.value = Math.max(0, since) * 14;
      wave.uniforms.uA.value = since > 0 ? Math.max(0, 1 - since / 3.5) * 1.2 + gold * 0.25 : 0;
    }

    const pos = geometry.attributes.position.array as Float32Array;
    const col = geometry.attributes.aColor.array as Float32Array;
    const sizeAttr = geometry.attributes.aSize.array as Float32Array;
    const time = clock.elapsedTime;
    seeds.forEach(([x, z, phase, speed], i) => {
      const k = (time * 0.12 * speed + phase) % 1;
      pos[i * 3] = x + Math.sin(time * 0.7 + phase * 9) * 0.4;
      pos[i * 3 + 1] = groundY + 0.5 + k * 9;
      pos[i * 3 + 2] = z;
      const b = gold * Math.sin(k * Math.PI) * 3.0;
      col[i * 3] = 1 * b;
      col[i * 3 + 1] = 0.76 * b;
      col[i * 3 + 2] = 0.28 * b;
      sizeAttr[i] = 0.6 * speed;
    });
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.aColor.needsUpdate = true;
    geometry.attributes.aSize.needsUpdate = true;
  });

  return (
    <group>
      <mesh ref={waveRef} material={waveMaterial} position={[cx, groundY + 0.05, cz]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[130, 130]} />
      </mesh>
      <points ref={emberRef} geometry={geometry} material={material} frustumCulled={false} />
    </group>
  );
}
