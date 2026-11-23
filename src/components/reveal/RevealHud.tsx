import { useEffect, useRef, useState } from 'react';
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
import { useTimeOfDay } from '../../state/sceneSettings';
import { useHudAutoDim } from '../../hooks/useHudAutoDim';

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
  const { mode } = useTimeOfDay();
  useHudAutoDim();
  const gold = state.gold > 0.5;
  const [clock, setClock] = useState(() => formatNow(new Date()));
  const [sheetOpen, setSheetOpen] = useState(false);

  const dockRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = window.setInterval(() => setClock(formatNow(new Date())), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const el = dockRef.current;
    if (!el) return;
    const root = el.closest('.reveal-root') as HTMLElement | null;
    const apply = () => {
      const parent = (el.offsetParent as HTMLElement | null) ?? el.parentElement;
      const fromBottom = (parent?.clientHeight ?? 1080) - el.offsetTop;
      root?.style.setProperty('--reveal-dock-height', `${Math.max(0, fromBottom)}px`);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root?.style.removeProperty('--reveal-dock-height');
    };
  }, []);

  return (
    <div className={`reveal-hud ${gold ? 'gold' : ''} ${interactive ? 'interactive' : ''} ${mode === 'day' ? 'day' : ''}`}>
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
      <Compass />
      <div className={`reveal-bottom-dock${sheetOpen ? ' sheet-open' : ''}`} ref={dockRef}>
        <div className="reveal-compact-bar">
          <OilTimeline collapsible />
          <button
            type="button"
            className="reveal-kpi-toggle"
            aria-expanded={sheetOpen}
            aria-controls="reveal-kpi-sheet"
            onClick={() => setSheetOpen((v) => !v)}
          >
            {sheetOpen ? 'Close KPIs' : 'KPIs'}
          </button>
        </div>
        <div id="reveal-kpi-sheet" className="reveal-kpi-sheet">
          <KpiRail state={state} interactive={interactive} />
        </div>
      </div>
    </div>
  );
}
