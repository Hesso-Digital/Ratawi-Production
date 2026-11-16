import { FieldMap } from '../components/FieldMap';
import { HeaderBar } from '../components/HeaderBar';
import { HeroCard } from '../components/HeroCard';
import { KpiTiles } from '../components/KpiTiles';
import { TrajectoryChart } from '../components/TrajectoryChart';
import { useCeremonyStore } from '../data/store';
import { useTileEntrance } from '../hooks/useTileEntrance';

export function AudiencePage() {
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
