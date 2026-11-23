import { useEffect, useState } from 'react';
import { WORDING } from '../../data/ceremonyConfig';
import { useCeremonyStore } from '../../data/store';
import { useDisplayedKpis } from '../../hooks/useDisplayedKpis';
import { useSceneSnapshot } from '../../scene/useSceneClock';
import { AlHarisHomeMark } from '../AlHarisHomeMark';
import { Compass } from './Compass';
import { HeroNumber } from './HeroNumber';
import { KpiRail } from './KpiRail';
import { OilTimeline } from './OilTimeline';
import { exploreStore } from '../../scene/explore/exploreStore';

function formatNow(d: Date) {
  const time = d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const date = d
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    .toUpperCase();
  return `${time}  ·  ${date}`;
}

export function RevealHud({ interactive = false }: { interactive?: boolean }) {
  const live = useSceneSnapshot();
  const state = useDisplayedKpis(live);
  const showDateTime = useCeremonyStore().settings.showDateTime;
  const gold = state.gold > 0.5;
  const [clock, setClock] = useState(() => formatNow(new Date()));

  useEffect(() => {
    const id = window.setInterval(() => setClock(formatNow(new Date())), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className={`reveal-hud ${gold ? 'gold' : ''} ${interactive ? 'interactive' : ''}`}>
      <div className="reveal-brand">
        <div className="eyebrow">{WORDING.eyebrow}</div>
        <div className="brand-title-row">
          <AlHarisHomeMark size={38} />
          <h1>{WORDING.title}</h1>
        </div>
        <div className="live">
          <i />
          <span>Live</span>
        </div>
        {showDateTime ? <div className="reveal-clock">{clock}</div> : null}
      </div>
      {interactive ? (
        <div onClick={() => exploreStore.openKpi('oil')}>
          <HeroNumber state={state} />
        </div>
      ) : (
        <HeroNumber state={state} />
      )}
      <OilTimeline />
      <Compass />
      <KpiRail state={state} interactive={interactive} />
    </div>
  );
}
