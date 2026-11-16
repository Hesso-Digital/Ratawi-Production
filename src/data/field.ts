/**
 * Field geometry traced from the official Ratawi concession and SPP photographs,
 * using the same plan-to-isometric projection as the v9 ceremony prototype.
 * Reimplemented here with no shared imports.
 */

export type Pt = { x: number; y: number };
export type Grid = [number, number];

export const CPF: Grid = [6.2, 6.5];
export const AG25: Grid = [4.5, 8.7];
export const EXPORT_END: Grid = [11.57, 7.6];

/** Concession boundary (red line on the reference map). West side estimated. */
export const CONCESSION: Grid[] = [
  [3.7, -3.27],
  [8.22, -3.13],
  [11.49, 0.78],
  [11.59, 10.92],
  [7.6, 16.76],
  [3.46, 16.76],
  [0.71, 10.92],
  [0.63, 0.78],
];

/** SPP outline (dotted blue line on the reference map). */
export const SPP: Grid[] = [
  [8.98, 1.65],
  [10.08, 1.65],
  [10.55, 1.32],
  [10.55, 0.08],
  [12.32, 0.08],
  [13.66, 1.92],
  [13.66, 2.69],
  [12.82, 2.69],
  [11.85, 3.49],
  [11.49, 3.49],
  [10.85, 2.69],
  [8.98, 2.69],
];

/** Placeholder export route from CPF-1 to the concession edge. */
export const EXPORT_LINE: Grid[] = [
  [6.2, 6.5],
  [8.6, 7.9],
  [10.4, 7.9],
  [11.57, 7.6],
  [13.2, 7.3],
];

export type WellKind = 'online' | 'agup';

export type Well = {
  name: string;
  x: number;
  y: number;
  kind: WellKind;
};

/**
 * Ceremony subset: 25 currently online wells plus 7 visually distinct AGUP wells.
 * Positions come from the field-map well list used in the prototypes.
 * The remaining photographed wells are omitted on purpose.
 */
export const WELLS: Well[] = [
  { name: 'RT-13', x: 6.5, y: 0.8, kind: 'online' },
  { name: 'RT-56', x: 4.2, y: 2, kind: 'online' },
  { name: 'RT-50', x: 5.8, y: 2, kind: 'online' },
  { name: 'RT-45', x: 6.8, y: 2, kind: 'online' },
  { name: 'RT-34', x: 5.5, y: 2.5, kind: 'online' },
  { name: 'RT-03', x: 6, y: 3, kind: 'online' },
  { name: 'RT-10', x: 4.5, y: 3.6, kind: 'online' },
  { name: 'RT-79', x: 5.5, y: 3.5, kind: 'online' },
  { name: 'RT-04', x: 10.5, y: 4, kind: 'online' },
  { name: 'RT-29', x: 7.5, y: 3.8, kind: 'online' },
  { name: 'RT-17', x: 6.5, y: 4, kind: 'online' },
  { name: 'RT-47', x: 9, y: 4.5, kind: 'online' },
  { name: 'RT-24', x: 5, y: 5, kind: 'online' },
  { name: 'RT-44', x: 7.2, y: 5.3, kind: 'online' },
  { name: 'RT-42', x: 7.5, y: 5.5, kind: 'online' },
  { name: 'RT-15', x: 7.5, y: 7.8, kind: 'online' },
  { name: 'RT-21', x: 7.2, y: 8, kind: 'online' },
  { name: 'RT-20', x: 4.5, y: 8, kind: 'online' },
  { name: 'RT-36', x: 6.5, y: 9, kind: 'online' },
  { name: 'RT-48', x: 9.5, y: 8.5, kind: 'online' },
  { name: 'RT-14', x: 6, y: 9.2, kind: 'online' },
  { name: 'RT-18', x: 8.2, y: 10.5, kind: 'online' },
  { name: 'RT-23', x: 5.5, y: 11, kind: 'online' },
  { name: 'RT-02', x: 6.2, y: 11.8, kind: 'online' },
  { name: 'RT-31', x: 8, y: 12, kind: 'online' },
  { name: 'RT-72', x: 4.5, y: 3.2, kind: 'agup' },
  { name: 'RT-71', x: 8.5, y: 3.5, kind: 'agup' },
  { name: 'RT-60', x: 7.5, y: 6.2, kind: 'agup' },
  { name: 'RT-68', x: 5.2, y: 6.8, kind: 'agup' },
  { name: 'RT-63', x: 8.5, y: 8.2, kind: 'agup' },
  { name: 'RT-66', x: 6, y: 10.5, kind: 'agup' },
  { name: 'RT-70', x: 8.5, y: 12.5, kind: 'agup' },
];

const KX = 1 / 0.00669;
const C0: Grid = [478, 1436];
const ROT = (-58 * Math.PI) / 180;
const PITCH = (56 * Math.PI) / 180;
const CAM = 5600;
const CR = Math.cos(ROT);
const SR = Math.sin(ROT);
const CPP = Math.cos(PITCH);
const SPP_P = Math.sin(PITCH);

export function toPlan(gx: number, gy: number): Grid {
  return [490 + (gx - 6.2) * KX, 1400 + (gy - 6.5) * KX];
}

function rotate(x: number, y: number): Grid {
  const dx = x - C0[0];
  const dy = y - C0[1];
  return [dx * CR - dy * SR, dx * SR + dy * CR];
}

export function projectPlan(x: number, y: number, z = 0): Pt {
  const [xr, yr] = rotate(x, y);
  const k = CAM / (CAM - yr * SPP_P);
  return { x: xr * k, y: (yr * CPP - z * SPP_P) * k };
}

export function project(gx: number, gy: number, z = 0): Pt {
  const [x, y] = toPlan(gx, gy);
  return projectPlan(x, y, z);
}

export function pts(list: Pt[]) {
  return list.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

export function pathFrom(grids: Grid[]) {
  return (
    'M' +
    grids
      .map(([x, y]) => {
        const p = project(x, y);
        return `${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
      })
      .join('L')
  );
}

export function pathFromPlan(list: Grid[]) {
  return (
    'M' +
    list
      .map(([x, y]) => {
        const p = projectPlan(x, y);
        return `${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
      })
      .join('L')
  );
}

export const CONCESSION_ISO = CONCESSION.map(([x, y]) => project(x, y));
export const SPP_ISO = SPP.map(([x, y]) => project(x, y));

const boundsSource = [
  ...CONCESSION_ISO,
  ...SPP_ISO,
  project(...EXPORT_LINE[EXPORT_LINE.length - 1]),
];
const xs = boundsSource.map((p) => p.x);
const ys = boundsSource.map((p) => p.y);
export const VIEWBOX = {
  x: Math.min(...xs) - 100,
  y: Math.min(...ys) - 150,
  w: Math.max(...xs) - Math.min(...xs) + 200,
  h: Math.max(...ys) - Math.min(...ys) + 190,
};

export const U = VIEWBOX.w / 1000;

export function parentOf(well: Well, pool: Well[]): Grid {
  const d = Math.hypot(well.x - CPF[0], well.y - CPF[1]);
  let best: Well | null = null;
  let bestD = d * 1.02;
  for (const other of pool) {
    if (other === well) continue;
    const od = Math.hypot(other.x - CPF[0], other.y - CPF[1]);
    if (od >= d * 0.8) continue;
    const dd = Math.hypot(other.x - well.x, other.y - well.y);
    if (dd < bestD) {
      bestD = dd;
      best = other;
    }
  }
  return best ? [best.x, best.y] : CPF;
}

export function box(x: number, y: number, w: number, d: number): Grid[] {
  return [
    [x, y],
    [x + w, y],
    [x + w, y + d],
    [x, y + d],
  ];
}

export function shade(hex: string, factor: number) {
  const n = Number.parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) =>
    Math.round(Math.max(0, Math.min(255, v * factor))),
  );
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

export function prismFaces(fp: Grid[], h: number, z0 = 0) {
  const walls = fp
    .map((a, i) => {
      const b = fp[(i + 1) % fp.length];
      const ra = rotate(...a);
      const rb = rotate(...b);
      const ex = rb[0] - ra[0];
      const ey = rb[1] - ra[1];
      const l = Math.hypot(ex, ey) || 1;
      return {
        k: (ra[1] + rb[1]) / 2,
        lum: 0.62 + 0.3 * ((ey / l) * -0.7 + (-ex / l) * 0.2),
        q: [
          projectPlan(...a, z0),
          projectPlan(...b, z0),
          projectPlan(...b, z0 + h),
          projectPlan(...a, z0 + h),
        ],
      };
    })
    .sort((a, b) => a.k - b.k);
  return {
    walls,
    roof: fp.map((p) => projectPlan(...p, z0 + h)),
  };
}
