/**
 * Flies the camera when a showpiece view opens, and hands it back to the show
 * camera when the view closes. Framing adapts to the canvas aspect so phones,
 * tablets, 4K monitors and the hall wall all keep the whole stack in frame.
 */
import { useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { sceneSettings, type ViewMode } from '../../state/sceneSettings';
import { exploreStore } from '../explore/exploreStore';
import { fieldTour } from '../explore/fieldTour';
import { EXPLODED_CAMERA, EXPLODED_CAMERA_PORTRAIT, RIBBON_CAMERA, RIBBON_CAMERA_PORTRAIT, framingFor } from './layout';
import { framingForAspect } from '../viewportFit';
import type { CameraState } from '../ceremonyTimeline';

/**
 * The rig pulls every flight back for tall screens (viewportFit.ts). The
 * showpiece views carry their own tighter portrait framing, so undo the rig's
 * pull here to land exactly on framingFor().
 */
function preCompensate(c: CameraState, aspect: number): CameraState {
  const { pull, fovAdd } = framingForAspect(aspect);
  return {
    position: [
      c.target[0] + (c.position[0] - c.target[0]) / pull,
      c.target[1] + (c.position[1] - c.target[1]) / pull,
      c.target[2] + (c.position[2] - c.target[2]) / pull,
    ],
    target: c.target,
    fov: c.fov - fovAdd,
  };
}

export function ViewModeDirector({ enabled }: { enabled: boolean }) {
  const gl = useThree((s) => s.gl);
  const prev = useRef<ViewMode>(sceneSettings.get().viewMode);

  useEffect(() => {
    if (!enabled) return;
    const aspect = () => {
      const el = gl.domElement;
      return (el.clientWidth || 1) / Math.max(1, el.clientHeight || 1);
    };
    const go = (mode: ViewMode, from: ViewMode) => {
      if (mode === 'exploded') exploreStore.flyToCamera(preCompensate(framingFor(EXPLODED_CAMERA, aspect(), EXPLODED_CAMERA_PORTRAIT), aspect()));
      else if (mode === 'ribbon') exploreStore.flyToCamera(preCompensate(framingFor(RIBBON_CAMERA, aspect(), RIBBON_CAMERA_PORTRAIT), aspect()));
      // Closing hands back to the show camera, unless the field tour has just taken the camera.
      else if (from !== 'field' && !fieldTour.get().playing) exploreStore.backToShow();
    };
    // Deep link (?view=exploded): frame it once the rig is up.
    const initial = sceneSettings.get().viewMode;
    const t = initial !== 'field' ? window.setTimeout(() => go(initial, 'field'), 60) : 0;
    const unsub = sceneSettings.subscribe(() => {
      const next = sceneSettings.get().viewMode;
      if (next !== prev.current) {
        const from = prev.current;
        prev.current = next;
        go(next, from);
      }
    });
    // Starting the field tour closes a showpiece view so the tour sees the whole field.
    const unsubTour = fieldTour.subscribe(() => {
      if (fieldTour.get().playing && sceneSettings.get().viewMode !== 'field') sceneSettings.setViewMode('field');
    });
    return () => {
      window.clearTimeout(t);
      unsub();
      unsubTour();
    };
  }, [enabled, gl]);

  return null;
}
