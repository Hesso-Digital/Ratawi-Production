import { WORDING } from '../../data/ceremonyConfig';
import { useSceneSnapshot } from '../../scene/useSceneClock';
import { Compass } from './Compass';
import { CountdownRing } from './CountdownRing';
import { HeroNumber } from './HeroNumber';
import { KpiRail } from './KpiRail';
import { PlaybackBar } from './PlaybackBar';
import { StepTracker } from './StepTracker';

export function RevealHud() {
  const state = useSceneSnapshot();
  const gold = state.gold > 0.5;
  const isPlayback = state.cueKind === 'playback';

  return (
    <div className={`reveal-hud ${gold ? 'gold' : ''}`}>
      <div className="reveal-brand">
        <div className="eyebrow">{WORDING.eyebrow}</div>
        <h1>{WORDING.title}</h1>
        <div className="live">
          <i />
          <span>Live</span>
        </div>
      </div>
      {isPlayback ? <PlaybackBar state={state} /> : <StepTracker state={state} />}
      <HeroNumber state={state} />
      <CountdownRing state={state} />
      <Compass state={state} />
      <KpiRail state={state} />
      {isPlayback ? (
        <div className="reveal-caption">
          From shutdown to above target in six months.
          <small>Replay · June to December 2026</small>
        </div>
      ) : null}
    </div>
  );
}
