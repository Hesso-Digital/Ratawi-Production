/**
 * Flies the camera when a showpiece view opens, and hands it back to the show
 * camera when the view closes. Framing adapts to the canvas aspect so phones,
 * tablets, 4K monitors and the hall wall all keep the whole stack in frame.
 */
import { useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { sceneSettings, type ViewMode } from '../../state/sceneSettings';
import { exploreStore } from '../explore/exploreStore';
import { adaptView, fieldTour } from '../explore/fieldTour';
import { EXPLODED_CAMERA, RIBBON_CAMERA } from './layout';

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
      if (mode === 'exploded') exploreStore.flyToCamera(adaptView(EXPLODED_CAMERA, aspect()));
      else if (mode === 'ribbon') exploreStore.flyToCamera(adaptView(RIBBON_CAMERA, aspect()));
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
