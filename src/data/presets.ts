import { DEFAULT_PRESETS } from './defaults';
import type { DataPresets, Snapshot } from './types';

export { DEFAULT_PRESETS, clonePresets } from './defaults';

export const SNAPSHOT_FIELDS = [
  { key: 'oil', label: 'Oil production', unit: 'kbopd', min: 0, max: 500, step: 0.1, integer: false },
  { key: 'wells', label: 'Wells online', unit: '', min: 0, max: 64, step: 1, integer: true },
  { key: 'exportKbopd', label: 'Oil export', unit: 'kbopd', min: 0, max: 500, step: 0.1, integer: false },
  { key: 'gas', label: 'Gas to AG-25', unit: 'MMscfd', min: 0, max: 500, step: 0.1, integer: false },
  { key: 'bsw', label: 'BS&W', unit: '%', min: 0, max: 100, step: 0.01, integer: false },
  { key: 'salt', label: 'Salt', unit: 'mg/l', min: 0, max: 10_000, step: 1, integer: true },
  { key: 'efficiency', label: 'Plant efficiency', unit: '%', min: 0, max: 100, step: 0.1, integer: false },
] as const;

export const LINE_FIELDS = [
  { key: 'commitmentKbopd', label: 'Commitment line', unit: 'kbopd', min: 0, max: 500, step: 0.1, integer: false },
  { key: 'targetKbopd', label: 'AGUP target line', unit: 'kbopd', min: 0, max: 500, step: 0.1, integer: false },
] as const;

export type FieldKey = (typeof SNAPSHOT_FIELDS)[number]['key'] | (typeof LINE_FIELDS)[number]['key'];

export type FieldErrors = Partial<Record<FieldKey, string>>;

export type PresetErrors = {
  current: FieldErrors;
  agup: FieldErrors;
  lines: FieldErrors;
};

function parseNumber(raw: string | number, integer: boolean): number | null {
  const n = typeof raw === 'number' ? raw : Number(raw.trim());
  if (!Number.isFinite(n)) return null;
  if (integer && !Number.isInteger(n)) return null;
  return n;
}

export function validateField(
  raw: string | number,
  min: number,
  max: number,
  integer: boolean,
): { value?: number; error?: string } {
  const n = parseNumber(raw, integer);
  if (n === null) return { error: integer ? 'Enter a whole number' : 'Enter a number' };
  if (n < min || n > max) return { error: `Enter a value from ${min} to ${max}` };
  return { value: n };
}

export function validateSnapshot(input: Snapshot): FieldErrors {
  const errors: FieldErrors = {};
  for (const field of SNAPSHOT_FIELDS) {
    const result = validateField(input[field.key], field.min, field.max, field.integer);
    if (result.error) errors[field.key] = result.error;
  }
  return errors;
}

export function validatePresets(presets: DataPresets): PresetErrors {
  const lines: FieldErrors = {};
  for (const field of LINE_FIELDS) {
    const result = validateField(presets[field.key], field.min, field.max, field.integer);
    if (result.error) lines[field.key] = result.error;
  }
  return {
    current: validateSnapshot(presets.current),
    agup: validateSnapshot(presets.agup),
    lines,
  };
}

export function presetsAreValid(errors: PresetErrors): boolean {
  return (
    Object.keys(errors.current).length === 0 &&
    Object.keys(errors.agup).length === 0 &&
    Object.keys(errors.lines).length === 0
  );
}

export function isAgupOnline(snapshot: Snapshot, presets: DataPresets): boolean {
  return snapshot.wells > presets.current.wells + 0.5;
}

export function isPresetSnapshot(v: unknown): v is Snapshot {
  if (!v || typeof v !== 'object') return false;
  const s = v as Record<string, unknown>;
  return SNAPSHOT_FIELDS.every((f) => typeof s[f.key] === 'number' && Number.isFinite(s[f.key]));
}

export function parsePresets(v: unknown, fallback: DataPresets = DEFAULT_PRESETS): DataPresets {
  if (!v || typeof v !== 'object') return { ...fallback, current: { ...fallback.current }, agup: { ...fallback.agup } };
  const raw = v as Partial<DataPresets>;
  return {
    current: isPresetSnapshot(raw.current) ? { ...raw.current } : { ...fallback.current },
    agup: isPresetSnapshot(raw.agup) ? { ...raw.agup } : { ...fallback.agup },
    commitmentKbopd:
      typeof raw.commitmentKbopd === 'number' && Number.isFinite(raw.commitmentKbopd)
        ? raw.commitmentKbopd
        : fallback.commitmentKbopd,
    targetKbopd:
      typeof raw.targetKbopd === 'number' && Number.isFinite(raw.targetKbopd) ? raw.targetKbopd : fallback.targetKbopd,
  };
}

export function linesFromPresets(presets: DataPresets) {
  return {
    commitmentKbopd: presets.commitmentKbopd,
    targetKbopd: presets.targetKbopd,
    currentWells: presets.current.wells,
    agupWells: presets.agup.wells,
  };
}
