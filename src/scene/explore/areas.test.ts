import { describe, expect, it } from 'vitest';
import { AREA_MARKERS, areaFootprint, focusGain, flySecondsFor } from './areas';
import { VIEW_PRESETS } from './assets';

describe('areas', () => {
  it('defines eight numbered area markers that match the viewpoint keys', () => {
    expect(AREA_MARKERS).toHaveLength(8);
    expect(VIEW_PRESETS).toHaveLength(8);
    expect(AREA_MARKERS.map((m) => m.id)).toEqual(VIEW_PRESETS.map((p) => p.id));
    expect(AREA_MARKERS.map((m) => m.key)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8']);
  });

  it('dims non-focused flowlines and keeps the focused group bright', () => {
    expect(focusGain(null, 'oil', 'RT-13')).toBe(1);
    expect(focusGain('aerial', 'export')).toBe(1);
    expect(focusGain('agup', 'agup', 'RT-60')).toBe(1);
    expect(focusGain('agup', 'oil', 'RT-13')).toBe(0.3);
    expect(focusGain('north', 'oil', 'RT-13')).toBe(1);
    expect(focusGain('north', 'oil', 'RT-02')).toBe(0.3);
    expect(focusGain('south', 'agup', 'RT-70')).toBe(1);
    expect(focusGain('export', 'export')).toBe(1);
    expect(focusGain('export', 'gas')).toBe(0.3);
  });

  it('uses 1.6 s for Whole field and AGUP, 1.5 s otherwise (when motion is not reduced)', () => {
    expect(flySecondsFor('preset', 'aerial').duration).toBe(1.6);
    expect(flySecondsFor('preset', 'agup').duration).toBe(1.6);
    expect(flySecondsFor('preset', 'cpf1').duration).toBe(1.5);
    expect(flySecondsFor('asset', 'well-RT-60').duration).toBe(1.5);
    expect(flySecondsFor('preset', 'aerial').arc).toBe(true);
  });

  it('returns a ground footprint for every viewpoint so the highlight can follow the fly-to', () => {
    for (const p of VIEW_PRESETS) {
      const foot = areaFootprint(p.id);
      expect(foot, p.id).not.toBeNull();
      expect(foot?.id).toBe(p.id);
      expect(foot && 'y' in foot && foot.y).toBeGreaterThan(-5);
    }
    expect(areaFootprint(null)).toBeNull();
    expect(areaFootprint('aerial')?.kind).toBe('polygon');
    expect(areaFootprint('export')?.kind).toBe('path');
  });
});
