import { QUALITY_PROFILES } from '../scene/quality';
import { useFlows, useTimeOfDay } from '../state/sceneSettings';
import type { DisplaySettings, Quality } from '../data/types';

export function DisplaySettingsFields({
  quality,
  settings,
  onQuality,
  onSettings,
}: {
  quality: Quality;
  settings: DisplaySettings;
  onQuality: (quality: Quality) => void;
  onSettings: (patch: Partial<DisplaySettings>) => void;
}) {
  const { mode, setMode } = useTimeOfDay();
  const { flows, setFlows } = useFlows();

  return (
    <div className="settings-fields">
      <label className="op-field">
        Quality
        <select value={quality} onChange={(e) => onQuality(e.target.value as Quality)} aria-label="Quality">
          {Object.values(QUALITY_PROFILES).map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <div className="settings-switch-row">
        <span id="settings-tod-label">Day / Night</span>
        <div className="admin-toggle" role="group" aria-labelledby="settings-tod-label">
          <button type="button" className={`chip${mode === 'night' ? ' on' : ''}`} aria-pressed={mode === 'night'} onClick={() => setMode('night')}>
            Night
          </button>
          <button type="button" className={`chip${mode === 'day' ? ' on' : ''}`} aria-pressed={mode === 'day'} onClick={() => setMode('day')}>
            Day
          </button>
        </div>
      </div>
      <div className="settings-switch-row">
        <span id="settings-flows-label">Flows</span>
        <div className="admin-toggle" role="group" aria-labelledby="settings-flows-label">
          <button type="button" className={`chip${flows ? '' : ' on'}`} aria-pressed={!flows} onClick={() => setFlows(false)}>
            Off
          </button>
          <button type="button" className={`chip${flows ? ' on' : ''}`} aria-pressed={flows} onClick={() => setFlows(true)}>
            On
          </button>
        </div>
      </div>
      <label className="op-check">
        <input
          type="checkbox"
          checked={settings.reducedMotion}
          onChange={(e) => onSettings({ reducedMotion: e.target.checked })}
        />
        Reduced motion
      </label>
      <label className="op-check">
        <input
          type="checkbox"
          checked={settings.showAreaMarkers}
          onChange={(e) => onSettings({ showAreaMarkers: e.target.checked })}
        />
        Show area markers
      </label>
      <label className="op-check">
        <input
          type="checkbox"
          checked={settings.showDateTime}
          onChange={(e) => onSettings({ showDateTime: e.target.checked })}
        />
        Show date and time
      </label>
    </div>
  );
}
