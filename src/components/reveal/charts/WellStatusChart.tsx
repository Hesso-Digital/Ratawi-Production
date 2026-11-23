/**
 * All 32 wells as status chips: 25 producing and the 7 AGUP wells, coloured by
 * the live scene state. Hover for details; click to highlight the well in 3D
 * and fly the camera to it.
 */
import { useState } from 'react';
import { WORLD_WELLS } from '../../../scene/world';
import type { SceneState } from '../../../scene/ceremonyTimeline';
import { assetById } from '../../../scene/explore/assets';
import { exploreStore, useExploreState } from '../../../scene/explore/exploreStore';

const ONLINE = WORLD_WELLS.filter((w) => w.kind === 'online');
const AGUP = WORLD_WELLS.filter((w) => w.kind === 'agup');

function Chip({ name, state }: { name: string; state: SceneState }) {
  const { selectedId } = useExploreState();
  const [hover, setHover] = useState(false);
  const id = `well-${name}`;
  const asset = assetById(id);
  const status = asset ? asset.status(state) : { label: '', tone: 'ok' as const };
  return (
    <button
      type="button"
      className={`well-chip ${status.tone} ${selectedId === id ? 'sel' : ''}`}
      data-well={name}
      onClick={() => exploreStore.inspect(id)}
      onPointerEnter={() => {
        setHover(true);
        exploreStore.hover(id);
      }}
      onPointerLeave={() => {
        setHover(false);
        if (exploreStore.get().hoveredId === id) exploreStore.hover(null);
      }}
    >
      <i />
      {name}
      {hover && asset ? (
        <span className="chip-tip">
          <b>{name}</b> {status.label} · {asset.role.split(' · ')[0]}
        </span>
      ) : null}
    </button>
  );
}

export function WellStatusChart({ state }: { state: SceneState }) {
  const agupOn = Math.max(0, Math.round(state.wells) - ONLINE.length);
  return (
    <div className="wells-chart">
      <div className="wells-group">
        <div className="wells-head">
          Producing <b>{ONLINE.length}</b>
        </div>
        <div className="wells-grid">
          {ONLINE.map((w) => (
            <Chip key={w.name} name={w.name} state={state} />
          ))}
        </div>
      </div>
      <div className="wells-group agup">
        <div className="wells-head">
          AGUP <b>{agupOn}</b> of {AGUP.length} online
        </div>
        <div className="wells-grid">
          {AGUP.map((w) => (
            <Chip key={w.name} name={w.name} state={state} />
          ))}
        </div>
      </div>
    </div>
  );
}
