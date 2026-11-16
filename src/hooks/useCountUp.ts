import gsap from 'gsap';
import { useEffect, useRef } from 'react';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

function formatValue(value: number, decimals: number) {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** GSAP count-up, same pattern as the WBMS command-centre hook. */
export function useCountUp<T extends HTMLElement>(
  value: number,
  { decimals = 0, durationS = 0.8 }: { decimals?: number; durationS?: number } = {},
) {
  const ref = useRef<T>(null);
  const shown = useRef<{ n: number } | null>(null);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const state = shown.current ?? { n: value };
    shown.current = state;
    const write = () => {
      el.textContent = formatValue(state.n, decimals);
    };

    const hidden = typeof document !== 'undefined' && document.hidden;
    if (reducedMotion || hidden || state.n === value) {
      state.n = value;
      write();
      return;
    }
    const tween = gsap.to(state, {
      n: value,
      duration: durationS,
      ease: 'power2.out',
      overwrite: 'auto',
      onUpdate: write,
      onComplete: write,
    });
    const onVis = () => {
      if (!document.hidden) return;
      tween.kill();
      state.n = value;
      write();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      tween.kill();
    };
  }, [value, decimals, durationS, reducedMotion]);

  return ref;
}
