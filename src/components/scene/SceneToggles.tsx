/**
 * Discreet icon buttons beside the compass: Day / Night, Flows on / off,
 * and the field tour Play / Stop control. Day / Night and Flows drive
 * src/state/sceneSettings.ts, which the corner menu can also call.
 */
import { useFlows, useTimeOfDay } from '../../state/sceneSettings';
import { useFieldTour } from '../../scene/explore/fieldTour';
import '../../styles/sceneToggles.css';
import { ViewModeButtons } from './ViewModeButtons';

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden="true">
      <circle cx="12" cy="12" r="4.2" fill="currentColor" />
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4;
        return (
          <line
            key={i}
            x1={12 + Math.cos(a) * 7}
            y1={12 + Math.sin(a) * 7}
            x2={12 + Math.cos(a) * 9.6}
            y2={12 + Math.sin(a) * 9.6}
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden="true">
      <path d="M15.5 3.5a8.5 8.5 0 1 0 5 13.6A7 7 0 0 1 15.5 3.5z" fill="currentColor" />
    </svg>
  );
}

function FlowIcon({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden="true">
      <path d="M3 8h11a3 3 0 0 1 0 6H6a3 3 0 0 0 0 6h15" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
      {on ? (
        <>
          <circle cx="9" cy="8" r="1.7" fill="currentColor" />
          <circle cx="12" cy="14" r="1.7" fill="currentColor" />
          <circle cx="16" cy="20" r="1.7" fill="currentColor" />
        </>
      ) : (
        <line x1="4" y1="3" x2="20" y2="21" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
      )}
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden="true">
      <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden="true">
      <rect x="6.5" y="6.5" width="11" height="11" rx="1.4" fill="currentColor" />
    </svg>
  );
}

export function SceneToggles() {
  const { mode, toggle } = useTimeOfDay();
  const { flows, toggleFlows } = useFlows();
  const { playing, caption, toggle: toggleTour } = useFieldTour();
  const dayLabel = mode === 'day' ? 'Switch to night view' : 'Switch to day view';
  const flowLabel = flows ? 'Flows on/off (on): hide flow animations' : 'Flows on/off (off): show flow animations';
  const tourLabel = playing ? 'Stop field tour' : 'Field tour';
  return (
    <>
    <div className="scene-toggles" role="group" aria-label="Scene view">
      <button
        type="button"
        className="scene-toggle"
        aria-label={`Day/Night: ${dayLabel}`}
        aria-pressed={mode === 'day'}
        title={mode === 'day' ? 'Day view. Click for night' : 'Night view. Click for day'}
        onClick={toggle}
      >
        {mode === 'day' ? <SunIcon /> : <MoonIcon />}
      </button>
      <button
        type="button"
        className="scene-toggle"
        aria-label="Flows on/off"
        aria-pressed={flows}
        data-state={flows ? 'on' : 'off'}
        title={flowLabel.replace('Flows on/off ', 'Flows ')}
        onClick={toggleFlows}
      >
        <FlowIcon on={flows} />
      </button>
      <button
        type="button"
        className="scene-toggle"
        data-field-tour-control=""
        aria-label={tourLabel}
        aria-pressed={playing}
        title="Field tour"
        onClick={toggleTour}
      >
        {playing ? <StopIcon /> : <PlayIcon />}
      </button>
      <ViewModeButtons />
    </div>
    {caption ? (
      <div className="field-tour-caption" aria-live="polite">
        {caption}
      </div>
    ) : null}
    </>
  );
}
