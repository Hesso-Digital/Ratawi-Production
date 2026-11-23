/**
 * Low/medium/high render-quality profiles, pattern from the WBMS
 * `scene-quality.ts` reuse note (integration-plan.md section 6), values tuned
 * for the ceremony budget (plan section 8): fewer than 250 draw calls, fewer
 * than 400k triangles, dpr 1.25–1.5 on the stage canvas, 60fps target on an
 * RTX-class venue PC and >=45fps on recent integrated graphics on "medium".
 *
 * Open input #4 (venue display + playback PC) is not yet confirmed, so this
 * defaults to "medium" and is switchable live from /operator.
 */
import type { Quality } from '../data/types';

export type QualityProfile = {
  id: Quality;
  label: string;
  /** Device pixel ratio clamp passed to the R3F <Canvas dpr={...}>. */
  dpr: [number, number];
  shadows: boolean;
  shadowMapSize: number;
  bloom: boolean;
  /** Terrain plane segment count per side. */
  terrainSegments: number;
  /** Particle count multiplier for flow dots / embers. */
  particleScale: number;
  /** Enable the drifting idle camera + well ring micro-animations. */
  microAnimations: boolean;
};

export const QUALITY_PROFILES: Record<Quality, QualityProfile> = {
  low: {
    id: 'low',
    label: 'Low (integrated GPU)',
    dpr: [1, 1],
    shadows: false,
    shadowMapSize: 1024,
    bloom: false,
    terrainSegments: 96,
    particleScale: 0.4,
    microAnimations: false,
  },
  medium: {
    id: 'medium',
    label: 'Medium (recommended)',
    dpr: [1, 1.25],
    shadows: true,
    shadowMapSize: 2048,
    bloom: true,
    terrainSegments: 160,
    particleScale: 0.7,
    microAnimations: true,
  },
  high: {
    id: 'high',
    label: 'High (RTX venue PC)',
    dpr: [1, 1.5],
    shadows: true,
    shadowMapSize: 4096,
    bloom: true,
    terrainSegments: 256,
    particleScale: 1,
    microAnimations: true,
  },
};

export function resolveQuality(fromUrl: string | null, fromOperator: Quality): Quality {
  if (fromUrl === 'low' || fromUrl === 'medium' || fromUrl === 'high') return fromUrl;
  return fromOperator;
}

/**
 * Cap device pixel ratio at 2, then lower it on large 2K/4K frames so the
 * hall machine is not filling 8K-worth of pixels.
 */
export function adaptiveDpr(
  range: [number, number],
  pixelCount = typeof window === 'undefined' ? 1920 * 1080 : window.innerWidth * window.innerHeight,
): [number, number] {
  let max = Math.min(range[1], 2);
  if (pixelCount >= 3840 * 2000) max = Math.min(max, 1.15);
  else if (pixelCount >= 2560 * 1400) max = Math.min(max, 1.35);
  return [range[0], max];
}
