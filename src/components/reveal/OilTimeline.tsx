import { useState } from 'react';
import { asOfStore, TIMELINE_LAST_INDEX, useAsOfState } from '../../data/asOfStore';
import { TODAY_INDEX, TRAJECTORY } from '../../data/defaults';
import { CountText } from '../CountText';

function formatDelta(n: number, decimals = 1) {
  const abs = Math.abs(n).toFixed(decimals);
  if (n > 0.0005) return `+${abs}`;
  if (n < -0.0005) return `−${abs}`;
  return decimals ? (0).toFixed(decimals) : '0';
}

export function OilCompare({
  actual,
  commitment,
  target,
}: {
  actual: number;
  commitment: number;
  target: number;
}) {
  return (
    <div className="oil-compare">
      <div>
        <span className="k">Actual</span>
        <b>
          <CountText value={actual} decimals={1} />
          <small> kbopd</small>
        </b>
      </div>
      <div>
        <span className="k">Commitment</span>
        <b>
          {commitment}
          <small className={actual >= commitment ? 'up' : 'down'}>{formatDelta(actual - commitment)}</small>
        </b>
      </div>
      <div>
        <span className="k">Target</span>
        <b>
          {target}
          <small className={actual >= target ? 'up' : 'down'}>{formatDelta(actual - target)}</small>
        </b>
      </div>
    </div>
  );
}

export function OilTimeline({
  compact = false,
  collapsible = false,
}: {
  compact?: boolean;
  /** Hall HUD: start as a compact reserved strip; months expand on demand. */
  collapsible?: boolean;
}) {
  const { index, playing } = useAsOfState();
  const cursor = index ?? TODAY_INDEX;
  const month = TRAJECTORY[Math.round(Math.max(0, Math.min(TIMELINE_LAST_INDEX, cursor)))];
  const live = index == null;
  const [expanded, setExpanded] = useState(!collapsible);
  const showMonths = !collapsible || expanded;
  const classes = [
    'oil-timeline',
    compact ? 'compact' : '',
    collapsible ? 'docked' : '',
    collapsible && !expanded ? 'collapsed' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      <div className="oil-timeline-head">
        <div className="oil-timeline-title">
          {live ? 'Live' : `As of ${month.label} ${month.year}`}
        </div>
        <div className="oil-timeline-actions">
          {playing ? (
            <button type="button" className="chip" onClick={() => asOfStore.pause()}>
              Pause
            </button>
          ) : (
            <button type="button" className="chip" onClick={() => asOfStore.play()}>
              Play
            </button>
          )}
          <button type="button" className={`chip${live ? ' on' : ''}`} onClick={() => asOfStore.live()}>
            Live
          </button>
          {collapsible ? (
            <button
              type="button"
              className="chip oil-timeline-toggle"
              aria-expanded={expanded}
              aria-label={expanded ? 'Hide month labels' : 'Show month labels'}
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? 'Hide months' : 'Months'}
            </button>
          ) : null}
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={TIMELINE_LAST_INDEX}
        step={0.01}
        value={cursor}
        aria-label="Production date"
        onPointerDown={() => asOfStore.setIndex(cursor)}
        onChange={(e) => asOfStore.setIndex(Number(e.target.value))}
      />
      {showMonths ? (
        <div
          className="oil-months"
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            if (r.width <= 0) return;
            const x = (e.clientX - r.left) / r.width;
            const i = x * TIMELINE_LAST_INDEX;
            asOfStore.setIndex(i);
          }}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            if (r.width <= 0) return;
            const x = (e.clientX - r.left) / r.width;
            asOfStore.setIndex(x * TIMELINE_LAST_INDEX);
          }}
        >
          {TRAJECTORY.map((m, i) => (
            <button
              key={m.key}
              type="button"
              className={`oil-month${Math.round(cursor) === i ? ' on' : ''}${m.kind === 'forecast' ? ' forecast' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                asOfStore.setIndex(i);
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
