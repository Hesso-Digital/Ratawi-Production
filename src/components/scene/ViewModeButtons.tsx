/**
 * Exploded layers and 3D production ribbon buttons, in the compass button
 * group. Pressing the lit one again returns to the field.
 */
import { useViewMode } from '../../state/sceneSettings';
import '../../styles/showpiece.css';

function LayersIcon() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden="true">
      <path d="M12 3 3 7.5 12 12l9-4.5z" fill="currentColor" />
      <path d="m3 12 9 4.5 9-4.5M3 16.5 12 21l9-4.5" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
    </svg>
  );
}

function RibbonIcon() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden="true">
      <path d="M3 19c3-1 4-8 7-8s3 4 6 4 3-8 5-10" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" />
      <path d="M3 21h18" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" opacity={0.6} />
    </svg>
  );
}

export function ViewModeButtons() {
  const { viewMode, toggleViewMode } = useViewMode();
  return (
    <>
      <button
        type="button"
        className="scene-toggle"
        data-view-control="exploded"
        aria-label={viewMode === 'exploded' ? 'Close exploded layers view' : 'Exploded layers view'}
        aria-pressed={viewMode === 'exploded'}
        data-state={viewMode === 'exploded' ? 'active' : undefined}
        title="Exploded layers"
        onClick={() => toggleViewMode('exploded')}
      >
        <LayersIcon />
      </button>
      <button
        type="button"
        className="scene-toggle"
        data-view-control="ribbon"
        aria-label={viewMode === 'ribbon' ? 'Close production ribbon view' : 'Production ribbon view'}
        aria-pressed={viewMode === 'ribbon'}
        data-state={viewMode === 'ribbon' ? 'active' : undefined}
        title="Production ribbon"
        onClick={() => toggleViewMode('ribbon')}
      >
        <RibbonIcon />
      </button>
    </>
  );
}
