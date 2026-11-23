/**
 * The Night Reveal 3D audience screen: canvas + HUD. WebGL or scene failures
 * stay on a neutral boot cover — they do not swap in the classic grid.
 * Prefers-reduced-motion no longer unmounts the hall design; tours already
 * honour it internally.
 */
import { useEffect, useMemo, useState } from 'react';
import { useProgress } from '@react-three/drei';
import { NightRevealCanvas } from '../scene/NightRevealCanvas';
import { SceneClockProvider } from '../scene/useSceneClock';
import { SceneErrorBoundary } from '../scene/SceneErrorBoundary';
import { RevealHud } from '../components/reveal/RevealHud';
import { ExploreOverlay } from '../components/reveal/ExploreOverlay';
import { HallBoot } from '../components/reveal/HallBoot';
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

function HallLoadGate() {
  const { active, progress, total } = useProgress();
  const [canvasOn, setCanvasOn] = useState(false);
  const [ready, setReady] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.querySelector('.reveal-canvas canvas')) setCanvasOn(true);
    }, 50);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!canvasOn || ready) return;
    const done = !active && (total === 0 || progress >= 100);
    if (!done) return;
    const t = window.setTimeout(() => setFading(true), 160);
    return () => window.clearTimeout(t);
  }, [canvasOn, active, progress, total, ready]);

  useEffect(() => {
    if (!fading) return;
    const t = window.setTimeout(() => setReady(true), 420);
    return () => window.clearTimeout(t);
  }, [fading]);

  useEffect(() => {
    const t = window.setTimeout(() => setFading(true), 8000);
    return () => window.clearTimeout(t);
  }, []);

  if (ready) return null;
  return <HallBoot fading={fading} />;
}

export function RevealAudience({
  autoDowngradeQuality = true,
}: {
  autoDowngradeQuality?: boolean;
}) {
  const store = useCeremonyStore();
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

  if (!webgl2 || fatal) {
    return <HallBoot message="This display needs WebGL 2" />;
  }

  const cue = presetCue ?? store.cue;
  const prevSnapshot = preset ? preset.from : store.prevSnapshot;
  const snapshot = preset ? preset.to : store.snapshot;
  const showRibbon = cue.kind === 'playback';

  return (
    <SceneClockProvider cue={cue} prevSnapshot={prevSnapshot} snapshot={snapshot} frozenAtS={preset?.elapsedS} lines={store.lines}>
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
        <RevealHud interactive={!locked} />
        {locked ? null : <ExploreOverlay />}
        <HallLoadGate />
      </div>
    </SceneClockProvider>
  );
}
