import { useEffect } from 'react';
import { sceneSettings } from '../state/sceneSettings';

const IDLE_MS = 3500;

/**
 * Dims the hall HUD after a short idle, and restores it on hover, pointer,
 * wheel or key interaction. Camera motion and exploded view should call
 * sceneSettings.requestHudDim('motion' | 'exploded') themselves; this hook
 * only owns the idle / user-hold reasons.
 */
export function useHudAutoDim() {
  useEffect(() => {
    let timer = 0;
    const bump = () => {
      sceneSettings.holdHud();
      sceneSettings.releaseHudDim('idle');
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        sceneSettings.releaseHold();
        sceneSettings.requestHudDim('idle');
      }, IDLE_MS);
    };
    bump();
    const evts: Array<keyof WindowEventMap> = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'];
    evts.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    return () => {
      evts.forEach((e) => window.removeEventListener(e, bump));
      window.clearTimeout(timer);
      sceneSettings.releaseHold();
      sceneSettings.releaseHudDim('idle');
    };
  }, []);
}
