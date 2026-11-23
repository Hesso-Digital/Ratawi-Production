import { useEffect, useState } from 'react';

export type ViewportMetrics = { width: number; height: number; aspect: number };

function metrics(): ViewportMetrics {
  if (typeof window === 'undefined') return { width: 1920, height: 1080, aspect: 16 / 9 };
  const width = window.innerWidth;
  const height = window.innerHeight;
  return { width, height, aspect: width / Math.max(1, height) };
}

function screenName(width: number, height: number) {
  const shortest = Math.min(width, height);
  const longest = Math.max(width, height);
  if (shortest <= 500 && longest <= 950) return 'phone';
  if (width <= 1100) return 'tablet';
  if (width < 2000) return 'desktop';
  if (width < 3000) return '2k';
  return '4k';
}

/**
 * Keeps CSS in sync with the live viewport. The stage itself now fills the
 * window (no 1920×1080 letterbox); this hook only publishes data attributes
 * and a scale hint some typography still uses.
 */
export function useStageScale() {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const measure = () => {
      const m = metrics();
      const root = document.documentElement;
      root.style.setProperty('--viewport-w', `${m.width}px`);
      root.style.setProperty('--viewport-h', `${m.height}px`);
      root.dataset.orientation = m.width >= m.height ? 'landscape' : 'portrait';
      root.dataset.screen = screenName(m.width, m.height);
      // Hint only: 1 at 1920×1080, gently up on 2K/4K, not used to letterbox.
      setScale(Math.min(2, Math.max(0.6, Math.sqrt((m.width / 1920) * (m.height / 1080)))));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  return scale;
}
