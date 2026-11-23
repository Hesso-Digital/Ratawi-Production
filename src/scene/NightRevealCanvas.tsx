/**
 * The <Canvas>: dpr from the quality profile, ACES + sRGB output, shader
 * pre-compile so the first cue doesn't stall, and every scene part mounted.
 * The camera is the cinematic show rig with free roam on top
 * (explore/ExploreCameraRig.tsx); `?locked=1` restores the display-only camera
 * and `?debug=orbit` starts in free roam with no return to the show.
 * Facilities and wellheads come from the GLB models in public/models when
 * present, with the procedural geometry as fallback (models/FieldModels.tsx).
 */
import { Canvas } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { Suspense, useCallback, useState } from 'react';
import { ACESFilmicToneMapping, SRGBColorSpace, type WebGLRenderer } from 'three';
import { ExploreCameraRig } from './explore/ExploreCameraRig';
import { AreaMarkers } from './explore/AreaMarkers';
import { InspectTargets } from './explore/InspectTargets';
import { exploreStore } from './explore/exploreStore';
import { FieldFacilities } from './models/FieldModels';
import { registerRenderer } from './models/glbLoader';
import { SkyAndFog } from './SkyAndFog';
import { Lighting } from './Lighting';
import { FieldTerrain } from './FieldTerrain';
import { ConcessionPentagon } from './ConcessionPentagon';
import { SppSolar } from './SppSolar';
import { FlowLines } from './FlowLines';
import { MilestoneShockwave } from './MilestoneShockwave';
import { ProductionRibbon } from './ProductionRibbon';
import { AnchoredTags } from './AnchoredTags';
import { PostFX } from './PostFX';
import { QUALITY_PROFILES } from './quality';
import type { CameraState } from './ceremonyTimeline';
import type { Quality } from '../data/types';
import { SceneToggles } from '../components/scene/SceneToggles';

export function NightRevealCanvas({
  quality,
  debugOrbit,
  showRibbon,
  cameraOverride,
  cueKey,
  locked = false,
  onQualityDrop,
}: {
  quality: Quality;
  debugOrbit: boolean;
  showRibbon: boolean;
  cameraOverride?: CameraState;
  /** Changes on every /operator cue so the show camera can take the view back. */
  cueKey: string;
  /** Display-only camera, no free roam or inspect. */
  locked?: boolean;
  onQualityDrop?: (next: Quality) => void;
}) {
  const profile = QUALITY_PROFILES[quality];
  const [frameloop] = useState<'always'>('always');

  const handleCreated = useCallback(({ gl }: { gl: WebGLRenderer }) => {
    gl.toneMapping = ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.05;
    gl.outputColorSpace = SRGBColorSpace;
    registerRenderer(gl);
  }, []);

  return (
    <>
    <Canvas
      className="reveal-canvas"
      frameloop={frameloop}
      resize={{ offsetSize: true }}
      dpr={profile.dpr}
      shadows={profile.shadows}
      gl={{ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
      camera={{ fov: 30, near: 0.5, far: 2000, position: [-118, 94, 44] }}
      onCreated={handleCreated}
      onPointerMissed={(e) => {
        if (e.type === 'click') exploreStore.select(null);
      }}
    >
      <Suspense fallback={null}>
        <ExploreCameraRig debugOrbit={debugOrbit} override={cameraOverride} cueKey={cueKey} locked={locked} />
        <SkyAndFog />
        <Lighting quality={profile} />
        <FieldTerrain quality={profile} />
        <ConcessionPentagon />
        <SppSolar />
        <FieldFacilities quality={profile} />
        <FlowLines quality={profile} />
        <MilestoneShockwave quality={profile} />
        {showRibbon ? <ProductionRibbon /> : <AnchoredTags />}
        {locked ? null : <InspectTargets />}
        {locked ? null : <AreaMarkers />}
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
    {locked ? null : <SceneToggles />}
    </>
  );
}
