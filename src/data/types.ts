export type CeremonyStep = 0 | 1 | 2;

export type DataOrigin = 'mock' | 'pi';

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

export type AppState = {
  snapshot: Snapshot;
  step: CeremonyStep;
  origin: DataOrigin;
};

export type ChannelMessage =
  | { type: 'state'; state: AppState }
  | { type: 'playback-start'; startedAt: number; duration: number }
  | { type: 'playback-stop' };
