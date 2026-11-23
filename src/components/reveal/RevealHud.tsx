import { useSceneSnapshot } from '../../scene/useSceneClock';
import { Compass } from './Compass';
import { CountdownRing } from './CountdownRing';
import { HeroNumber } from './HeroNumber';
import { KpiRail } from './KpiRail';
import { PlaybackBar } from './PlaybackBar';
import { StepTracker } from './StepTracker';

export function RevealHud({ playbackProgress }: { playbackProgress: number | null }) {
  const state = useSceneSnapshot();
  const gold = state.gold > 0.5;
  const isPlayback = state.cueKind === 'playback';

  return (
    <div className={`reveal-hud ${gold ? 'gold' : ''}`}>
      <div className="reveal-brand">
        <div className="eyebrow">AGUP Phase 1 · RFSU</div>
        <h1>Ratawi Production</h1>
        <div className="live">
          <i />
          <span>Live</span>
        </div>
      </div>
      {isPlayback ? <PlaybackBar progress={playbackProgress ?? 0} /> : <StepTracker state={state} />}
      <HeroNumber state={state} />
      <CountdownRing state={state} />
      <Compass state={state} />
      <KpiRail state={state} />
      {isPlayback ? (
        <div className="reveal-caption">
          “And we hit 120 kbopd, above target. And we can go further.”
          <small>Playback · Jun 2026 → Apr 2027 · forecast after Dec</small>
        </div>
      ) : null}
    </div>
  );
}
