import { BASELINE } from './defaults';
import type { DataOrigin, Snapshot } from './types';

/** Swap this implementation for a PI Vision client without touching the UI. */
export interface ProductionFeed {
  origin: DataOrigin;
  readSnapshot(): Promise<Snapshot>;
}

export const manualFeed: ProductionFeed = {
  origin: 'manual',
  async readSnapshot() {
    return { ...BASELINE };
  },
};
