import { useEffect, useMemo, useState } from 'react';
import { LINE_FIELDS, SNAPSHOT_FIELDS, presetsAreValid, validatePresets, type PresetErrors } from '../data/presets';
import type { DataPresets, Snapshot } from '../data/types';

function SnapshotFields({
  title,
  value,
  errors,
  onChange,
}: {
  title: string;
  value: Snapshot;
  errors: PresetErrors['current'];
  onChange: (next: Snapshot) => void;
}) {
  return (
    <fieldset className="preset-block">
      <legend>{title}</legend>
      <div className="op-grid">
        {SNAPSHOT_FIELDS.map((field) => (
          <label key={field.key}>
            {field.label}
            {field.unit ? <span className="unit"> {field.unit}</span> : null}
            <input
              type="number"
              step={field.step}
              min={field.min}
              max={field.max}
              value={Number.isFinite(value[field.key]) ? value[field.key] : ''}
              aria-invalid={errors[field.key] ? true : undefined}
              aria-label={`${title} ${field.label}`}
              onChange={(e) => {
                const n = e.target.value === '' ? Number.NaN : Number(e.target.value);
                onChange({ ...value, [field.key]: n });
              }}
            />
            {errors[field.key] ? <span className="field-error">{errors[field.key]}</span> : null}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function DataPresetsForm({
  presets,
  onSave,
  onResetDefaults,
  compact = false,
}: {
  presets: DataPresets;
  onSave: (next: DataPresets) => boolean;
  onResetDefaults: () => void;
  compact?: boolean;
}) {
  const [draft, setDraft] = useState<DataPresets>(presets);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft(presets);
  }, [presets]);

  const errors = useMemo(() => validatePresets(draft), [draft]);
  const valid = presetsAreValid(errors);

  const submit = () => {
    if (!valid) return;
    if (onSave(draft)) {
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1600);
    }
  };

  return (
    <div className={`presets-form${compact ? ' compact' : ''}`}>
      <div className={`presets-cols${compact ? ' stacked' : ''}`}>
        <SnapshotFields
          title="Current"
          value={draft.current}
          errors={errors.current}
          onChange={(current) => setDraft((d) => ({ ...d, current }))}
        />
        <SnapshotFields
          title="AGUP online"
          value={draft.agup}
          errors={errors.agup}
          onChange={(agup) => setDraft((d) => ({ ...d, agup }))}
        />
      </div>
      <fieldset className="preset-block">
        <legend>Chart lines</legend>
        <div className="op-grid">
          {LINE_FIELDS.map((field) => (
            <label key={field.key}>
              {field.label}
              <span className="unit"> {field.unit}</span>
              <input
                type="number"
                step={field.step}
                min={field.min}
                max={field.max}
                value={Number.isFinite(draft[field.key]) ? draft[field.key] : ''}
                aria-invalid={errors.lines[field.key] ? true : undefined}
                aria-label={field.label}
                onChange={(e) => {
                  const n = e.target.value === '' ? Number.NaN : Number(e.target.value);
                  setDraft((d) => ({ ...d, [field.key]: n }));
                }}
              />
              {errors.lines[field.key] ? <span className="field-error">{errors.lines[field.key]}</span> : null}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="op-actions">
        <button className="btn primary" type="button" disabled={!valid} onClick={submit}>
          Save
        </button>
        <button className="btn" type="button" onClick={onResetDefaults}>
          Reset to defaults
        </button>
        {saved ? <span className="save-ok">Saved</span> : null}
        {!valid ? <span className="field-error">Fix the highlighted values before saving.</span> : null}
      </div>
    </div>
  );
}
