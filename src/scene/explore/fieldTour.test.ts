import { afterEach, describe, expect, it } from 'vitest';
import { VIEW_PRESETS } from './assets';
import {
  adaptView,
  attachTourInterrupts,
  fieldTour,
  framingForAspect,
  isTourInterrupt,
  REF_ASPECT,
} from './fieldTour';
import { buildTourShots, tourCaptions, tourDuration } from './fieldTourShots';
import { sceneSettings } from '../../state/sceneSettings';
import { asOfStore } from '../../data/asOfStore';

afterEach(() => {
  fieldTour.reset();
  asOfStore.live();
});

describe('framingForAspect', () => {
  it('keeps 16:9 close to the designed distance and FOV', () => {
    const f = framingForAspect(REF_ASPECT);
    expect(f.distanceScale).toBeCloseTo(1, 3);
    expect(f.fovDelta).toBe(0);
  });

  it('pulls the camera back on portrait and other narrow aspects', () => {
    const portrait = framingForAspect(9 / 16);
    const tablet = framingForAspect(3 / 4);
    const fourByThree = framingForAspect(4 / 3);
    expect(portrait.distanceScale).toBeGreaterThan(tablet.distanceScale);
    expect(tablet.distanceScale).toBeGreaterThan(fourByThree.distanceScale);
    expect(fourByThree.distanceScale).toBeGreaterThan(1);
    expect(portrait.distanceScale).toBeGreaterThanOrEqual(1.8);
    expect(portrait.fovDelta).toBeGreaterThan(fourByThree.fovDelta);
  });

  it('only eases off slightly on ultra-wide hall screens', () => {
    const wide = framingForAspect(21 / 9);
    const ultra = framingForAspect(32 / 9);
    expect(wide.distanceScale).toBeGreaterThanOrEqual(1);
    expect(wide.distanceScale).toBeLessThan(1.1);
    expect(ultra.distanceScale).toBeGreaterThan(wide.distanceScale);
    expect(ultra.distanceScale).toBeLessThanOrEqual(1.12);
    expect(wide.fovDelta).toBe(0);
  });

  it('adaptView moves the camera farther from the target in portrait', () => {
    const view = VIEW_PRESETS[0].camera;
    const wide = adaptView(view, 16 / 9);
    const portrait = adaptView(view, 9 / 16);
    const dist = (v: typeof view) =>
      Math.hypot(v.position[0] - v.target[0], v.position[1] - v.target[1], v.position[2] - v.target[2]);
    expect(dist(portrait)).toBeGreaterThan(dist(wide) * 1.5);
    expect(portrait.fov).toBeGreaterThan(wide.fov);
    expect(portrait.target).toEqual(view.target);
  });
});

describe('tour shots', () => {
  it('lasts 45–75 s at normal motion and is much shorter when motion is reduced', () => {
    const normal = tourDuration({ reducedMotion: false });
    const reduced = tourDuration({ reducedMotion: true });
    expect(normal).toBeGreaterThanOrEqual(45);
    expect(normal).toBeLessThanOrEqual(75);
    expect(reduced).toBeLessThan(20);
    expect(reduced).toBeLessThan(normal * 0.4);
  });

  it('visits the whole field, CPF-1, AG-25, AGUP, SPP, export and the other area views', () => {
    const captions = tourCaptions().join(' | ');
    expect(captions).toMatch(/Whole field/);
    expect(captions).toMatch(/CPF-1/);
    expect(captions).toMatch(/AG-25/);
    expect(captions).toMatch(/AGUP/);
    expect(captions).toMatch(/SPP/);
    expect(captions).toMatch(/Export/);
    expect(captions).toMatch(/North wells/);
    expect(captions).toMatch(/South wells/);
    const areas = new Set(buildTourShots().map((s) => s.areaId));
    for (const id of ['aerial', 'cpf1', 'ag25', 'agup', 'export', 'spp', 'north', 'south']) {
      expect(areas.has(id)).toBe(true);
    }
    expect(captions.toLowerCase()).not.toMatch(/dummy|demo|prototype|simulation/);
  });
});

function fixture() {
  const root = document.createElement('div');
  const canvas = document.createElement('canvas');
  canvas.className = 'reveal-canvas';
  const toggles = document.createElement('div');
  toggles.className = 'scene-toggles';
  const playBtn = document.createElement('button');
  playBtn.setAttribute('data-field-tour-control', '');
  const dayBtn = document.createElement('button');
  dayBtn.className = 'scene-toggle';
  toggles.append(dayBtn, playBtn);
  const marker = document.createElement('button');
  marker.className = 'area-marker';
  marker.dataset.area = 'cpf1';
  const input = document.createElement('input');
  const hud = document.createElement('div');
  hud.className = 'reveal-hud';
  root.append(canvas, toggles, marker, input, hud);
  document.body.appendChild(root);
  return { root, canvas, playBtn, dayBtn, marker, input, hud, cleanup: () => root.remove() };
}

describe('isTourInterrupt', () => {
  it('does nothing when the tour is not playing', () => {
    const f = fixture();
    expect(isTourInterrupt({ type: 'pointerdown', target: f.canvas }, { playing: false })).toBe(false);
    f.cleanup();
  });

  it('stops on pointerdown, wheel and touchstart on the canvas', () => {
    const f = fixture();
    expect(isTourInterrupt({ type: 'pointerdown', target: f.canvas }, { playing: true })).toBe(true);
    expect(isTourInterrupt({ type: 'wheel', target: f.canvas }, { playing: true })).toBe(true);
    expect(isTourInterrupt({ type: 'touchstart', target: f.canvas }, { playing: true })).toBe(true);
    f.cleanup();
  });

  it('stops on an area-marker click even though the marker is a DOM overlay', () => {
    const f = fixture();
    expect(isTourInterrupt({ type: 'pointerdown', target: f.marker }, { playing: true })).toBe(true);
    f.cleanup();
  });

  it('stops on a keydown (and Escape) but not while typing in a field', () => {
    const f = fixture();
    expect(isTourInterrupt({ type: 'keydown', target: f.hud, key: 'ArrowLeft' }, { playing: true })).toBe(true);
    expect(isTourInterrupt({ type: 'keydown', target: f.hud, key: 'Escape' }, { playing: true })).toBe(true);
    expect(isTourInterrupt({ type: 'keydown', target: f.input, key: 'a' }, { playing: true })).toBe(false);
    expect(isTourInterrupt({ type: 'keydown', target: f.hud, key: 'Shift' }, { playing: true })).toBe(false);
    f.cleanup();
  });

  it('does not stop when the Play button or the other scene toggles are used', () => {
    const f = fixture();
    expect(isTourInterrupt({ type: 'pointerdown', target: f.playBtn }, { playing: true })).toBe(false);
    expect(isTourInterrupt({ type: 'pointerdown', target: f.dayBtn }, { playing: true })).toBe(false);
    f.cleanup();
  });

  it('does not treat a click on the rest of the HUD as a map interaction', () => {
    const f = fixture();
    expect(isTourInterrupt({ type: 'pointerdown', target: f.hud }, { playing: true })).toBe(false);
    f.cleanup();
  });
});

describe('attachTourInterrupts', () => {
  it('stops the tour on canvas pointerdown and on an area-marker pointerdown, but not on the Play button', () => {
    const f = fixture();
    let playing = true;
    let stops = 0;
    const handle = attachTourInterrupts(window, {
      isPlaying: () => playing,
      onStop: () => {
        stops += 1;
        playing = false;
      },
    });

    f.playBtn.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(stops).toBe(0);
    expect(playing).toBe(true);

    f.canvas.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(stops).toBe(1);
    expect(playing).toBe(false);

    playing = true;
    f.marker.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(stops).toBe(2);

    handle.stop();
    f.cleanup();
  });
});

describe('fieldTour store', () => {
  it('toggles playing and advances start/stop sequences', () => {
    expect(fieldTour.get().playing).toBe(false);
    fieldTour.start();
    expect(fieldTour.get().playing).toBe(true);
    expect(fieldTour.get().startSeq).toBe(1);
    expect(fieldTour.get().caption).toBe('Whole field');
    fieldTour.start();
    expect(fieldTour.get().startSeq).toBe(1);
    fieldTour.setCaption('CPF-1');
    expect(fieldTour.get().caption).toBe('CPF-1');
    fieldTour.stop();
    expect(fieldTour.get().playing).toBe(false);
    expect(fieldTour.get().caption).toBe(null);
    expect(fieldTour.get().stopSeq).toBe(1);
  });

  it('dims the HUD while the tour plays and restores it when the tour stops', () => {
    expect(sceneSettings.getHudDimmed()).toBe(false);
    fieldTour.start();
    expect(sceneSettings.getHudDimmed()).toBe(true);
    expect(document.documentElement.dataset.hudDimmed).toBe('on');
    fieldTour.stop();
    expect(sceneSettings.getHudDimmed()).toBe(false);
    expect(document.documentElement.dataset.hudDimmed).toBe('off');
  });

  it('plays the oil timeline for the tour duration and returns to Live on stop', () => {
    expect(asOfStore.get().playing).toBe(false);
    expect(asOfStore.get().index).toBe(null);
    fieldTour.start();
    expect(asOfStore.get().playing).toBe(true);
    expect(asOfStore.get().index).toBe(0);
    fieldTour.stop();
    expect(asOfStore.get().playing).toBe(false);
    expect(asOfStore.get().index).toBe(null);
  });

  it('can stop the tour without forcing the timeline back to Live', () => {
    fieldTour.start();
    fieldTour.stop({ restoreLive: false });
    expect(fieldTour.get().playing).toBe(false);
    expect(asOfStore.get().playing).toBe(true);
  });
});
