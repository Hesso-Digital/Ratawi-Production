/**
 * Geometry, framing and data shaping for the two showpiece views
 * (exploded glass layers and the 3D production ribbon). Pure functions only,
 * so the layout is unit-tested without a renderer.
 */
import { CONCESSION_WORLD, polygonBounds, type Vec2 } from '../world';
import type { CameraState } from '../ceremonyTimeline';
import type { MonthPoint } from '../../data/types';

/** Concession footprint, world units. */
export const FIELD_BOUNDS = polygonBounds(CONCESSION_WORLD);
export const FIELD_CENTER: Vec2 = [
  (FIELD_BOUNDS.minX + FIELD_BOUNDS.maxX) / 2,
  (FIELD_BOUNDS.minZ + FIELD_BOUNDS.maxZ) / 2,
];

/**
 * Exploded stack, bottom to top. The reservoir slab sits on the ground; the
 * gathering network and the surface facilities lift by these amounts when the
 * view is fully open (explodeBlend = 1).
 */
export const LAYERS = {
  reservoir: { y: 0.6, thickness: 2.6 },
  network: { lift: 11 },
  surface: { lift: 22 },
  /** Top of the red concession prism above the surface glass. */
  prismTop: 27,
  /** The prism flares a little toward the top, like the concept. */
  prismTopScale: 1.1,
  prismBottomScale: 1.03,
} as const;

export type LayerId = 'network' | 'surface';

export function layerLift(layer: LayerId, blend: number): number {
  const b = Math.max(0, Math.min(1, blend));
  return LAYERS[layer].lift * b;
}

/** Scale a polygon about the field centre. */
export function scalePolygon(poly: readonly Vec2[], k: number, center: Vec2 = FIELD_CENTER): Vec2[] {
  return poly.map(([x, z]) => [center[0] + (x - center[0]) * k, center[1] + (z - center[1]) * k] as Vec2);
}

/** Exploded framing at 16:9: from the south-east, a little above the stack. */
export const EXPLODED_CAMERA: CameraState = {
  // Kept relative to the field centre so the shot follows the concession outline.
  position: [FIELD_CENTER[0] + 128, 84, FIELD_CENTER[1] + 82],
  target: [FIELD_CENTER[0], 11, FIELD_CENTER[1]],
  fov: 32,
};

/** Horizontal unit vector from the stack toward the exploded camera. */
export const EXPLODED_FACING: Vec2 = (() => {
  const dx = EXPLODED_CAMERA.position[0] - EXPLODED_CAMERA.target[0];
  const dz = EXPLODED_CAMERA.position[2] - EXPLODED_CAMERA.target[2];
  const l = Math.hypot(dx, dz) || 1;
  return [dx / l, dz / l];
})();

/**
 * Production ribbon. Months run south (left on screen) to north (right) along z,
 * on a vertical band west of CPF-1 so the plant reads in front of it.
 */
export const RIBBON = {
  x: -18,
  zStart: 52,
  zEnd: -62,
  baseY: 3,
  yPerKbopd: 0.21,
  /** Band depth across x, world units. */
  width: 5,
  /** Height of the glowing sheet below the value line, world units. */
  height: 3.4,
  /** The band snakes east and west along its length so it reads in 3D, not as a flat chart. */
  sway: 12,
  samplesPerMonth: 18,
  samplesPerMonthLow: 8,
} as const;

export const RIBBON_CAMERA: CameraState = {
  position: [118, 62, 26],
  target: [-14, 15, -5],
  fov: 34,
};

export function ribbonZ(index: number, months: number): number {
  const t = months <= 1 ? 0 : index / (months - 1);
  return RIBBON.zStart + (RIBBON.zEnd - RIBBON.zStart) * t;
}

/** East–west position of the band centre at a fractional month index. */
export function ribbonX(index: number, months: number): number {
  const t = months <= 1 ? 0 : index / (months - 1);
  return RIBBON.x + Math.sin(t * Math.PI * 1.25 - 0.4) * RIBBON.sway;
}

export function ribbonY(value: number): number {
  return RIBBON.baseY + value * RIBBON.yPerKbopd;
}

/** Centripetal-free, monotone-friendly cubic Hermite sampling (no overshoot below zero). */
export function sampleSeries(values: readonly number[], samplesPerSegment: number): Array<{ i: number; v: number }> {
  const out: Array<{ i: number; v: number }> = [];
  const n = values.length;
  if (n === 0) return out;
  if (n === 1) return [{ i: 0, v: values[0] }];
  // Fritsch–Carlson monotone slopes.
  const d: number[] = [];
  for (let k = 0; k < n - 1; k++) d.push(values[k + 1] - values[k]);
  const m: number[] = new Array(n);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let k = 1; k < n - 1; k++) m[k] = d[k - 1] * d[k] <= 0 ? 0 : (d[k - 1] + d[k]) / 2;
  for (let k = 0; k < n - 1; k++) {
    if (d[k] === 0) {
      m[k] = 0;
      m[k + 1] = 0;
      continue;
    }
    const a = m[k] / d[k];
    const b = m[k + 1] / d[k];
    const h = a * a + b * b;
    if (h > 9) {
      const t = 3 / Math.sqrt(h);
      m[k] = t * a * d[k];
      m[k + 1] = t * b * d[k];
    }
  }
  for (let k = 0; k < n - 1; k++) {
    for (let s = 0; s < samplesPerSegment; s++) {
      const t = s / samplesPerSegment;
      const t2 = t * t;
      const t3 = t2 * t;
      const v =
        (2 * t3 - 3 * t2 + 1) * values[k] +
        (t3 - 2 * t2 + t) * m[k] +
        (-2 * t3 + 3 * t2) * values[k + 1] +
        (t3 - t2) * m[k + 1];
      out.push({ i: k + t, v });
    }
  }
  out.push({ i: n - 1, v: values[n - 1] });
  return out;
}

export type Milestone = { index: number; month: string; value: number; tag: string };

/**
 * Milestones read straight from the series: the start, the highest recorded
 * month, the AGUP RFSU month and the last month on the timeline.
 */
export function ribbonMilestones(
  months: readonly MonthPoint[],
  values: readonly number[],
  agupIndex: number,
): Milestone[] {
  if (months.length === 0) return [];
  const last = months.length - 1;
  let peak = 0;
  for (let i = 0; i < months.length; i++) {
    if (months[i].kind === 'actual' && values[i] > values[peak]) peak = i;
  }
  const picks: Array<{ index: number; tag: string }> = [
    { index: 0, tag: `${months[0].label} ${months[0].year}` },
    { index: peak, tag: `${months[peak].label} · Peak` },
    { index: agupIndex, tag: `${months[agupIndex]?.label ?? ''} · AGUP` },
    { index: last, tag: `${months[last].label} ${months[last].year}` },
  ];
  const seen = new Set<number>();
  return picks
    .filter((p) => p.index >= 0 && p.index <= last && !seen.has(p.index) && (seen.add(p.index), true))
    .map((p) => ({ index: p.index, month: months[p.index].label, value: values[p.index], tag: p.tag }));
}

/**
 * Ribbon shade by value against the plan lines: deep blue to cyan up to the
 * commitment, cyan to gold between commitment and target, gold at or above it.
 */
const BLUE = [0.16, 0.46, 1.0];
const CYAN = [0.22, 0.86, 1.0];
const ICE = [0.82, 0.93, 1.0];
const GOLD = [1.0, 0.74, 0.24];
function mix(a: number[], b: number[], k: number): [number, number, number] {
  const t = Math.max(0, Math.min(1, k));
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
/** Neon magenta for forecast months (sRGB 0..1), matching CHART.forecast #ff4fd8. */
export const FORECAST_RGB: [number, number, number] = [1.0, 0.31, 0.85];

/**
 * Colour of the ribbon at fractional month `i`: the value shade up to the
 * latest actual month, then blending into the forecast magenta over half a month.
 */
export function ribbonColorAt(
  i: number,
  value: number,
  commitment: number,
  target: number,
  lastActualIndex: number,
): [number, number, number] {
  const base = ribbonColor(value, commitment, target);
  const k = Math.max(0, Math.min(1, (i - lastActualIndex) / 0.5));
  return k <= 0 ? base : mix(base, FORECAST_RGB, k);
}

export function ribbonColor(value: number, commitment: number, target: number): [number, number, number] {
  if (value <= commitment) return mix(BLUE, CYAN, commitment > 0 ? value / commitment : 1);
  if (value >= target) return [GOLD[0], GOLD[1], GOLD[2]];
  const k = (value - commitment) / Math.max(1e-6, target - commitment);
  return k < 0.5 ? mix(CYAN, ICE, k * 2) : mix(ICE, GOLD, (k - 0.5) * 2);
}

/**
 * Portrait framings: look up the long north–south axis so the stack's narrow
 * side spans the narrow screen, instead of shrinking the side-on 16:9 shot.
 */
export const EXPLODED_CAMERA_PORTRAIT: CameraState = {
  position: [FIELD_CENTER[0] + 46, 104, FIELD_CENTER[1] + 128],
  target: [FIELD_CENTER[0], 12, FIELD_CENTER[1] + 4],
  fov: 34,
};
export const RIBBON_CAMERA_PORTRAIT: CameraState = {
  position: [78, 64, 118],
  target: [-14, 16, 0],
  fov: 36,
};

/**
 * Responsive framing for the showpiece views. Wide screens keep the designed
 * shot (easing back a touch on ultra-wide walls); portrait screens switch to
 * the end-on shot and pull back only as far as the narrower width needs.
 */
export function framingFor(view: CameraState, aspect: number, portrait?: CameraState): CameraState {
  const a = Math.min(3.2, Math.max(0.4, aspect));
  const ref = 16 / 9;
  let base = view;
  let distance = 1;
  if (a < 1 && portrait) {
    base = portrait;
    distance = Math.min(1.45, 1 + (1 / a - 1) * 0.4);
  } else if (a < ref) {
    distance = Math.min(1.8, 1 + (ref / a - 1) * 0.7);
  } else {
    distance = 1 + Math.min(0.12, ((a - ref) / ref) * 0.15);
  }
  return {
    position: [
      base.target[0] + (base.position[0] - base.target[0]) * distance,
      base.target[1] + (base.position[1] - base.target[1]) * distance,
      base.target[2] + (base.position[2] - base.target[2]) * distance,
    ],
    target: base.target,
    fov: base.fov,
  };
}
