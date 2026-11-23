import { useAsOfState } from '../data/asOfStore';
import { isAgupOnline } from '../data/presets';
import { snapshotAtMonth } from '../data/series';
import { useCeremonyStore } from '../data/store';
import type { SceneState } from '../scene/ceremonyTimeline';

/** Scene numbers for the HUD: live Current/AGUP values, or the timeline "as of" date. */
export function useDisplayedKpis(state: SceneState): SceneState {
  const asOf = useAsOfState();
  const store = useCeremonyStore();
  if (asOf.index == null) return state;
  const online = isAgupOnline(store.snapshot, store.presets) || store.cue.kind === 'step2' || store.step >= 2;
  const snap = snapshotAtMonth(asOf.index, store.presets, online);
  const gold = snap.oil >= store.presets.targetKbopd - 1e-6 ? 1 : 0;
  return {
    ...state,
    ...snap,
    gold,
    step: gold ? 3 : snap.wells > store.presets.current.wells + 0.5 ? 2 : 0,
  };
}
