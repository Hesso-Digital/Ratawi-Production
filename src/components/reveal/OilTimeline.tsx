import { useState } from 'react';
import { asOfStore, TIMELINE_LAST_INDEX, useAsOfState } from '../../data/asOfStore';
import { fieldTour } from '../../scene/explore/fieldTour';
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
        <span className="k">Target</span>
        <b>
          {commitment}
          <small className={actual >= commitment ? 'up' : 'down'}>{formatDelta(actual - commitment)}</small>
        </b>
      </div>
      <div>
        <span className="k">AGUP target</span>
        <b>
          {target}
          <small className={actual >= target ? 'up' : 'down'}>{formatDelta(actual - target)}</small>
        </b>
      </div>
    </div>
  );
}

function scrubAsOf(index: number) {
  if (fieldTour.get().playing) fieldTour.stop({ restoreLive: false });
  asOfStore.setIndex(index);
}

export function OilTimeline({
  compact = false,
  collapsible = false,
  hall = false,
}: {
  compact?: boolean;
  /** Hall HUD: start as a compact reserved strip; months expand on demand. */
  collapsible?: boolean;
  /** Hall overlay: slim scrubber only, no Play / Live / Months chrome. */
  hall?: boolean;
}) {
  const { index, playing } = useAsOfState();
  const cursor = index ?? TODAY_INDEX;
  const month = TRAJECTORY[Math.round(Math.max(0, Math.min(TIMELINE_LAST_INDEX, cursor)))];
  const live = index == null;
  const [expanded, setExpanded] = useState(!collapsible);
  const showMonths = !hall && (!collapsible || expanded);
  const classes = [
    'oil-timeline',
    compact ? 'compact' : '',
    collapsible || hall ? 'docked' : '',
    hall ? 'hall' : '',
    (collapsible && !expanded && !hall) ? 'collapsed' : '',
    playing ? 'playing' : '',
    live ? 'is-live' : '',
    !live && cursor > TODAY_INDEX + 0.5 ? 'in-forecast' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      <div className="oil-timeline-head">
        {hall && !live ? (
          <button
            type="button"
            className="oil-timeline-title live-back"
            onClick={() => asOfStore.live()}
          >
            {`As of ${month.label} ${month.year}`}
            {cursor > TODAY_INDEX + 0.5 ? <span className="forecast-tag"> · Forecast</span> : null}
          </button>
        ) : (
          <div className="oil-timeline-title">
            {live ? 'Live' : `As of ${month.label} ${month.year}`}
            {!live && cursor > TODAY_INDEX + 0.5 ? <span className="forecast-tag"> · Forecast</span> : null}
          </div>
        )}
        {hall ? null : (
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
        )}
      </div>
      <input
        type="range"
        min={0}
        max={TIMELINE_LAST_INDEX}
        step={0.01}
        value={cursor}
        aria-label="Production date"
        onPointerDown={() => scrubAsOf(cursor)}
        onChange={(e) => scrubAsOf(Number(e.target.value))}
      />
      <div className="oil-forecast-strip" aria-hidden="true">
        <i style={{ left: `${(TODAY_INDEX / TIMELINE_LAST_INDEX) * 100}%` }} />
      </div>
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
