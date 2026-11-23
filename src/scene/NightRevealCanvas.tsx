/**
 * The <Canvas>: dpr from the quality profile, ACES + sRGB output, shader
 * pre-compile so the first cue doesn't stall, and every scene part mounted.
 * `?debug=orbit` swaps the audience camera rig for drei OrbitControls so the
 * operator can frame/rehearse shots.
 */
import { Canvas } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { Suspense, useCallback, useState } from 'react';
import { ACESFilmicToneMapping, SRGBColorSpace, type WebGLRenderer } from 'three';
import { CameraRig } from './CameraRig';
import { SkyAndFog } from './SkyAndFog';
import { Lighting } from './Lighting';
import { FieldTerrain } from './FieldTerrain';
import { ConcessionPentagon } from './ConcessionPentagon';
import { SppSolar } from './SppSolar';
import { CPF1 } from './facilities/CPF1';
import { AG25 } from './facilities/AG25';
import { Wells } from './Wells';
import { FlowLines } from './FlowLines';
import { MilestoneShockwave } from './MilestoneShockwave';
import { ProductionRibbon } from './ProductionRibbon';
import { AnchoredTags } from './AnchoredTags';
import { PostFX } from './PostFX';
import { QUALITY_PROFILES } from './quality';
import type { CameraState } from './ceremonyTimeline';
import type { Quality } from '../data/types';

export function NightRevealCanvas({
  quality,
  debugOrbit,
  showRibbon,
  cameraOverride,
  onQualityDrop,
}: {
  quality: Quality;
  debugOrbit: boolean;
  showRibbon: boolean;
  cameraOverride?: CameraState;
  onQualityDrop?: (next: Quality) => void;
}) {
  const profile = QUALITY_PROFILES[quality];
  const [frameloop] = useState<'always'>('always');

  const handleCreated = useCallback(({ gl }: { gl: WebGLRenderer }) => {
    gl.toneMapping = ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.05;
    gl.outputColorSpace = SRGBColorSpace;
  }, []);

  return (
    <Canvas
      className="reveal-canvas"
      frameloop={frameloop}
      resize={{ offsetSize: true }}
      dpr={profile.dpr}
      shadows={profile.shadows}
      gl={{ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
      camera={{ fov: 30, near: 0.5, far: 2000, position: [-118, 94, 44] }}
      onCreated={handleCreated}
    >
      <Suspense fallback={null}>
        <CameraRig debugOrbit={debugOrbit} override={cameraOverride} />
        <SkyAndFog />
        <Lighting quality={profile} />
        <FieldTerrain quality={profile} />
        <ConcessionPentagon />
        <SppSolar />
        <CPF1 />
        <AG25 />
        <Wells quality={profile} />
        <FlowLines quality={profile} />
        <MilestoneShockwave quality={profile} />
        {showRibbon ? <ProductionRibbon /> : <AnchoredTags />}
        {profile.bloom ? <PostFX /> : null}
        {onQualityDrop ? (
          <PerformanceMonitor
            onDecline={() => {
              if (quality === 'high') onQualityDrop('medium');
              else if (quality === 'medium') onQualityDrop('low');
            }}
          />
        ) : null}
      </Suspense>
    </Canvas>
  );
}
