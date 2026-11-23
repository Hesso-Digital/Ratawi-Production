import { describe, expect, it } from 'vitest';
import { sceneSettings } from './sceneSettings';

describe('scene view mode', () => {
  it('starts on the field and toggles each showpiece view on and off, dimming the HUD meanwhile', () => {
    expect(sceneSettings.get().viewMode).toBe('field');
    expect(sceneSettings.getHudDimmed()).toBe(false);
    sceneSettings.toggleViewMode('exploded');
    expect(sceneSettings.get().viewMode).toBe('exploded');
    expect(sceneSettings.getHudDimmed()).toBe(true);
    sceneSettings.toggleViewMode('ribbon');
    expect(sceneSettings.get().viewMode).toBe('ribbon');
    expect(sceneSettings.getHudDimmed()).toBe(true);
    sceneSettings.toggleViewMode('ribbon');
    expect(sceneSettings.get().viewMode).toBe('field');
    expect(sceneSettings.getHudDimmed()).toBe(false);
    expect(document.documentElement.dataset.viewMode).toBe('field');
  });

  it('leaves other HUD dim reasons alone when a view closes', () => {
    sceneSettings.requestHudDim('tour');
    sceneSettings.setViewMode('exploded');
    sceneSettings.setViewMode('field');
    expect(sceneSettings.getHudDimmed()).toBe(true);
    sceneSettings.releaseHudDim('tour');
    expect(sceneSettings.getHudDimmed()).toBe(false);
  });
});
