/**
 * The original SVG dashboard (plan section 1 & rules: "keep the existing
 * screen working at /classic as the fallback"). Unchanged layout and
 * components; only KpiTiles/HeroCard internals were touched (shared kpis.ts,
 * "Commitment" wording) — nothing here changes visually.
 */
import { FieldMap } from '../components/FieldMap';
import { HeaderBar } from '../components/HeaderBar';
import { HeroCard } from '../components/HeroCard';
import { KpiTiles } from '../components/KpiTiles';
import { TrajectoryChart } from '../components/TrajectoryChart';
import { useCeremonyStore } from '../data/store';
import { useTileEntrance } from '../hooks/useTileEntrance';

export function ClassicAudience() {
  const { display, playback, progress } = useCeremonyStore();
  const root = useTileEntrance<HTMLDivElement>();

  return (
    <div ref={root}>
      <HeaderBar />
      <div className="audience">
        <FieldMap wellsOnline={display.wells} gas={display.gas} />
        <div className="right-col">
          <HeroCard oil={display.oil} />
          <KpiTiles data={display} />
        </div>
        <TrajectoryChart progress={progress} playing={playback.playing} />
      </div>
    </div>
  );
}
