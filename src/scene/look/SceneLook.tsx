/**
 * Scene-wide finish: a procedural studio environment (no HDR download, built
 * once from light formers) for polished steel and glass reflections, and the
 * per-frame drivers for the day clay crossfade and environment strength.
 *
 * Night: low, warm/cyan rim reflections so steel reads like the concept
 * closeup without lifting the dark ground. Day: bright soft studio light for
 * the sand-model look.
 */
import { Environment, Lightformer } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { dayBlend } from '../../state/sceneSettings';
import { clayUniform } from './clay';
import type { QualityProfile } from '../quality';

export function SceneLook({ quality }: { quality: QualityProfile }) {
  const scene = useThree((s) => s.scene);
  useFrame(() => {
    const day = dayBlend.value;
    clayUniform.value = day;
    scene.environmentIntensity = 0.95 - 0.2 * day;
  });

  return (
    <Environment resolution={quality.id === 'high' ? 256 : 128} frames={1} background={false}>
      {/* Overhead soft box */}
      <Lightformer form="rect" intensity={1.6} color="#dfe6f2" position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[12, 12, 1]} />
      {/* Warm sodium strips (east) and cool cyan strips (west): the concept's two-tone steel highlights */}
      <Lightformer form="rect" intensity={3.2} color="#ffb35c" position={[6, 1.5, 0]} rotation-y={-Math.PI / 2} scale={[8, 0.6, 1]} />
      <Lightformer form="rect" intensity={2.4} color="#4dd6ff" position={[-6, 1.2, 0]} rotation-y={Math.PI / 2} scale={[8, 0.5, 1]} />
      <Lightformer form="ring" intensity={1.2} color="#ffffff" position={[0, 3, -6]} scale={3} />
      {/* Horizon band all round, so curved steel always has a soft gradient to reflect */}
      {[0, 1, 2, 3].map((i) => (
        <Lightformer
          key={i}
          form="rect"
          intensity={0.9}
          color={i % 2 ? '#c9d4e6' : '#e8dccb'}
          position={[Math.sin((i * Math.PI) / 2) * 7, 0.5, Math.cos((i * Math.PI) / 2) * 7]}
          rotation-y={(i * Math.PI) / 2 + Math.PI}
          scale={[12, 11, 1]}
        />
      ))}
      {/* Dark ground bounce */}
      <Lightformer form="rect" intensity={0.6} color="#6a5038" position={[0, -4, 0]} rotation-x={-Math.PI / 2} scale={[20, 20, 1]} />
    </Environment>
  );
}
