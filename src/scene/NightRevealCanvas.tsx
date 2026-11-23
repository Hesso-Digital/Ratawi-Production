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
import { SceneLook } from './look/SceneLook';
import { QUALITY_PROFILES } from './quality';
import type { CameraState } from './ceremonyTimeline';
import type { Quality } from '../data/types';
import { SceneToggles } from '../components/scene/SceneToggles';
import { AreaFocusHighlight } from './explore/AreaFocusHighlight';
import { useAdaptiveDpr } from '../hooks/useAdaptiveDpr';
import { useViewMode } from '../state/sceneSettings';
import { LayerLift } from './showpiece/LayerLift';
import { ExplodedLayers } from './showpiece/ExplodedLayers';
import { ProductionRibbon3D } from './showpiece/ProductionRibbon3D';
import { ViewModeDirector } from './showpiece/ViewModeDirector';

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
  const dpr = useAdaptiveDpr(profile.dpr);
  /** Exploded layers / production ribbon: field-level tags and markers step aside. */
  const showpiece = useViewMode().viewMode !== 'field';
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
      dpr={dpr}
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
        <SceneLook quality={profile} />
        <Lighting quality={profile} />
        <FieldTerrain quality={profile} />
        <ConcessionPentagon />
        <LayerLift layer="surface">
          <SppSolar />
          <FieldFacilities quality={profile} />
        </LayerLift>
        <LayerLift layer="network">
          <FlowLines quality={profile} />
        </LayerLift>
        <MilestoneShockwave quality={profile} />
        <ExplodedLayers quality={profile} />
        <ProductionRibbon3D quality={profile} />
        <ViewModeDirector enabled={!locked} />
        {showpiece ? null : showRibbon ? <ProductionRibbon /> : <AnchoredTags />}
        {locked || showpiece ? null : <InspectTargets />}
        {locked || showpiece ? null : <AreaMarkers />}
        {locked || showpiece ? null : <AreaFocusHighlight />}
        {profile.bloom ? <PostFX quality={profile} /> : null}
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
