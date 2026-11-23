import { QUALITY_PROFILES } from '../scene/quality';
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
