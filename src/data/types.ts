export type CeremonyStep = 0 | 1 | 2;

export type DataOrigin = 'manual' | 'pi';

export type Snapshot = {
  oil: number;
  wells: number;
  exportKbopd: number;
  gas: number;
  bsw: number;
  salt: number;
  efficiency: number;
};

export type MonthPoint = {
  key: string;
  label: string;
  year: number;
  monthIndex: number;
  oil: number;
  wells: number;
  exportKbopd: number;
  gas: number;
  /** Actual history through November, forecast from December. */
  kind: 'actual' | 'forecast';
};

/** Ceremony view shown on the audience display. */
export type ViewMode = 'reveal' | 'classic' | 'fallback';

/** 3D render quality profile, see src/scene/quality.ts. */
export type Quality = 'low' | 'medium' | 'high';

/**
 * A cue is the single thing the operator broadcasts to start a choreographed
 * beat. `startedAt` is wall-clock (Date.now()), so a late-joining or refreshed
 * audience window can resume mid-sequence: elapsed = now - startedAt.
 */
export type DataPresets = {
  current: Snapshot;
  agup: Snapshot;
  commitmentKbopd: number;
  targetKbopd: number;
};

export type DisplaySettings = {
  reducedMotion: boolean;
  showAreaMarkers: boolean;
  showDateTime: boolean;
};

export type CueKind = 'idle' | 'countdown' | 'step1' | 'step2' | 'playback' | 'live';

export type Cue = {
  kind: CueKind;
  startedAt: number;
};

export type AppState = {
  snapshot: Snapshot;
  /** The snapshot the current cue animates FROM. Equal to snapshot outside a cue. */
  prevSnapshot: Snapshot;
  step: CeremonyStep;
  origin: DataOrigin;
  cue: Cue;
  view: ViewMode;
  quality: Quality;
  /** Editable Current and AGUP online values, plus chart reference lines. */
  presets: DataPresets;
  settings: DisplaySettings;
};

export type ChannelMessage =
  | { type: 'state'; state: AppState }
  | { type: 'cue'; cue: Cue };
