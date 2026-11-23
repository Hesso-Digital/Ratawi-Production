/**
 * The Night Reveal 3D audience screen: canvas + HUD. Falls back to the classic
 * grid automatically with no WebGL2, after the error boundary gives up, or
 * with prefers-reduced-motion (plan section 8).
 */
import { useEffect, useMemo, useState } from 'react';
import { NightRevealCanvas } from '../scene/NightRevealCanvas';
import { SceneClockProvider } from '../scene/useSceneClock';
import { SceneErrorBoundary } from '../scene/SceneErrorBoundary';
import { RevealHud } from '../components/reveal/RevealHud';
import { ExploreOverlay } from '../components/reveal/ExploreOverlay';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { resolveQuality } from '../scene/quality';
import { FRAME_PRESETS, presetForGlobalTime, presetForReplay } from '../scene/framePresets';
import { useCeremonyStore } from '../data/store';
import type { Cue, Quality } from '../data/types';

function hasWebGL2(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!canvas.getContext('webgl2');
  } catch {
    return false;
  }
}

export function RevealAudience({
  onFallback,
  autoDowngradeQuality = true,
}: {
  onFallback: (reason: string) => void;
  autoDowngradeQuality?: boolean;
}) {
  const store = useCeremonyStore();
  const reducedMotion = usePrefersReducedMotion();
  const [fatal, setFatal] = useState<string | null>(null);
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const debugOrbit = params.get('debug') === 'orbit';
  /** `?locked=1` keeps the hall display-only (no free roam, no inspect). */
  const locked = params.get('locked') === '1';
  const quality = resolveQuality(params.get('quality'), store.quality);
  const webgl2 = useMemo(() => hasWebGL2(), []);

  /**
   * `?frame=F1..F6|F2b` or `?t=<seconds>` freeze the scene at a specific
   * approved-frame beat for rehearsal deep-links and e2e screenshots
   * (src/scene/framePresets.ts), bypassing the operator-driven store.
   */
  const preset = useMemo(() => {
    const frameParam = params.get('frame');
    if (frameParam && FRAME_PRESETS[frameParam]) return FRAME_PRESETS[frameParam];
    const replayParam = params.get('replay');
    if (replayParam !== null && Number.isFinite(Number(replayParam))) return presetForReplay(Number(replayParam));
    const tParam = params.get('t');
    if (tParam !== null) {
      const t = Number(tParam);
      if (Number.isFinite(t)) return presetForGlobalTime(t);
    }
    return null;
  }, [params]);

  const presetCue: Cue | null = useMemo(
    () => (preset ? { kind: preset.cueKind, startedAt: Date.now() - preset.elapsedS * 1000 } : null),
    [preset],
  );

  useEffect(() => {
    if (!webgl2) onFallback('no-webgl2');
    else if (reducedMotion) onFallback('reduced-motion');
  }, [webgl2, reducedMotion, onFallback]);

  useEffect(() => {
    if (fatal) onFallback(fatal);
  }, [fatal, onFallback]);

  if (!webgl2 || reducedMotion || fatal) return null;

  const cue = presetCue ?? store.cue;
  const prevSnapshot = preset ? preset.from : store.prevSnapshot;
  const snapshot = preset ? preset.to : store.snapshot;
  const showRibbon = cue.kind === 'playback';

  return (
    <SceneClockProvider cue={cue} prevSnapshot={prevSnapshot} snapshot={snapshot} frozenAtS={preset?.elapsedS}>
      <div className="reveal-root">
        <SceneErrorBoundary onFatal={() => setFatal('scene-crash')}>
          <div className="reveal-canvas-wrap">
            <NightRevealCanvas
              quality={quality}
              debugOrbit={debugOrbit}
              showRibbon={showRibbon}
              cameraOverride={preset?.cameraOverride}
              cueKey={`${cue.kind}:${cue.startedAt}`}
              locked={locked}
              onQualityDrop={autoDowngradeQuality && !params.get('quality') && !preset ? (q: Quality) => store.setQuality(q) : undefined}
            />
          </div>
        </SceneErrorBoundary>
        <div className="reveal-vignette" />
        <RevealHud />
        {locked ? null : <ExploreOverlay />}
      </div>
    </SceneClockProvider>
  );
}
