import gsap from 'gsap';
import { useLayoutEffect, useRef } from 'react';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

/** Stagger [data-entrance] descendants, same pattern as WBMS useTileEntrance. */
export function useTileEntrance<T extends HTMLElement>(ready = true) {
  const ref = useRef<T>(null);
  const reducedMotion = usePrefersReducedMotion();

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || !ready) return;
    const nodes = root.querySelectorAll<HTMLElement>('[data-entrance]');
    const hidden = typeof document !== 'undefined' && document.hidden;
    if (reducedMotion || hidden || nodes.length === 0) {
      gsap.set(nodes, { clearProps: 'opacity,visibility,transform' });
      return;
    }
    gsap.set(nodes, { autoAlpha: 0, y: 26, scale: 0.97 });
    const tween = gsap.to(nodes, {
      autoAlpha: 1,
      y: 0,
      scale: 1,
      duration: 0.8,
      ease: 'expo.out',
      stagger: 0.09,
      overwrite: 'auto',
    });
    const onVis = () => {
      if (document.hidden) return;
      tween.progress(1);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      tween.kill();
      gsap.set(nodes, { clearProps: 'opacity,visibility,transform' });
    };
  }, [reducedMotion, ready]);

  return ref;
}
