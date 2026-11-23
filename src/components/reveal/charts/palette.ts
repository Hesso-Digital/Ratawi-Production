/** Holographic chart palette, shared with the 3D scene (cyan idle, gold active, red limits). */
export const CHART = {
  cyan: '#4dd0e1',
  gold: '#ffb300',
  gas: '#b08cff',
  export: '#7fe3c4',
  red: '#ff3333',
  grid: 'rgba(77, 208, 225, 0.12)',
  axis: '#6f8a97',
  text: '#c8d4dc',
} as const;

export type ChartTone = 'oil' | 'gas' | 'quality' | 'export';

export function toneColor(tone: ChartTone, gold = false): string {
  if (gold) return CHART.gold;
  if (tone === 'gas') return CHART.gas;
  if (tone === 'export') return CHART.export;
  return CHART.cyan;
}
