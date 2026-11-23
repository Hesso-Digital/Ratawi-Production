/**
 * Field geometry traced from Gulmira's 16 Nov 2026 map references
 * (official red concession outline, SPP / CPF-1 satellite, and the wells
 * photograph). Grid: +x east, +y south, origin reference CPF-1 at [6.2, 6.5].
 * The 3D scene is a compressed schematic (see WORLD_SCALE in world.ts);
 * relative bearings and the concession aspect follow the photographs.
 *
 * Open questions for the client (names, RT-10, pentagon wording, AG-25 seat,
 * export heading) live in src/data/ceremonyConfig.ts OPEN_QUESTIONS so an
 * answer can be swapped later without hunting through this file.
 */

export type Pt = { x: number; y: number };
export type Grid = [number, number];

export const CPF: Grid = [6.2, 6.5];
/** Beside CPF-1, south-west. Unconfirmed against the maps; see OPEN_QUESTIONS.ag25Position. */
export const AG25: Grid = [4.5, 8.7];

/**
 * Official red-line photograph is an elongated 8-vertex chamfered outline
 * (aspect N/E ≈ 1.72), not a circle and not a 5-gon. See OPEN_QUESTIONS.concessionShape.
 */
export const CONCESSION: Grid[] = [
  [-0.73, -5.732],
  [8.344, -5.059],
  [10.025, -2.483],
  [10.025, 10.513],
  [6.776, 15.554],
  [-1.29, 15.666],
  [-2.411, 11.409],
  [-2.231, -2.259],
];

/** SPP footprint from the satellite (stepped rectangle, western bay, northern step). Centroid ≈ 3.2 km east, 7.2 km north of CPF-1. */
export const SPP: Grid[] = [
  [5.986, 0.083],
  [5.986, 1.366],
  [7.098, 1.366],
  [7.098, 1.794],
  [12.147, 1.794],
  [12.66, 0.853],
  [12.318, -0.858],
  [10.606, -1.457],
  [9.58, -1.457],
  [9.58, -0.687],
  [7.526, -0.687],
  [7.526, 0.083],
];

/** Indicative export corridor (SE from south of CPF-1). Heading is visual only; see OPEN_QUESTIONS.exportHeading. */
export const EXPORT_LINE: Grid[] = [
  [6.2, 6.5],
  [6.414, 7.356],
  [8.211, 8.725],
  [9.58, 9.923],
  [10.606, 11.463],
  [10.949, 12.832],
];

export const EXPORT_END: Grid = EXPORT_LINE[EXPORT_LINE.length - 1];

export type WellKind = 'online' | 'agup';

export type Well = {
  name: string;
  x: number;
  y: number;
  kind: WellKind;
};

/**
 * Ceremony subset: 25 currently online wells plus 7 AGUP wells, placed from
 * the 16 Nov wells photograph (N–S spine through CPF-1). Wells that would
 * sit inside the oversized CPF-1 mesh are nudged out along their photo
 * bearing by ~2 world units past the mesh. The remaining photographed wells
 * are omitted on purpose.
 *
 * RT-10 is kept at its previous grid; it is not labelled on the photograph
 * (OPEN_QUESTIONS.rt10). The 7 AGUP names are the working set
 * (OPEN_QUESTIONS.agupNames).
 */
export const WELLS: Well[] = [
  { name: 'RT-13', x: 5.445, y: 0.426, kind: 'online' },
  { name: 'RT-56', x: 5.112, y: 1.443, kind: 'online' },
  { name: 'RT-50', x: 5.594, y: 1.835, kind: 'online' },
  { name: 'RT-45', x: 6.299, y: 1.859, kind: 'online' },
  { name: 'RT-34', x: 5.286, y: 2.26, kind: 'online' },
  { name: 'RT-03', x: 5.543, y: 2.738, kind: 'online' },
  { name: 'RT-10', x: 4.5, y: 3.6, kind: 'online' },
  { name: 'RT-72', x: 4.444, y: 2.97, kind: 'agup' },
  { name: 'RT-79', x: 5.22, y: 3.064, kind: 'online' },
  { name: 'RT-17', x: 5.857, y: 3.441, kind: 'online' },
  { name: 'RT-29', x: 6.535, y: 3.522, kind: 'online' },
  { name: 'RT-71', x: 7.269, y: 3.616, kind: 'agup' },
  { name: 'RT-24', x: 5.297, y: 4.051, kind: 'online' },
  { name: 'RT-04', x: 9.329, y: 3.788, kind: 'online' },
  { name: 'RT-44', x: 5.835, y: 4.359, kind: 'online' },
  { name: 'RT-42', x: 6.922, y: 4.359, kind: 'online' },
  { name: 'RT-47', x: 8.7, y: 4.963, kind: 'online' },
  { name: 'RT-60', x: 7.101, y: 4.359, kind: 'agup' },
  { name: 'RT-68', x: 3.7, y: 5.944, kind: 'agup' },
  { name: 'RT-15', x: 8.395, y: 8.641, kind: 'online' },
  { name: 'RT-21', x: 7.468, y: 8.641, kind: 'online' },
  { name: 'RT-20', x: 3.7, y: 8.065, kind: 'online' },
  { name: 'RT-63', x: 8.582, y: 8.641, kind: 'agup' },
  { name: 'RT-48', x: 8.536, y: 8.641, kind: 'online' },
  { name: 'RT-36', x: 6.328, y: 8.641, kind: 'online' },
  { name: 'RT-14', x: 5.679, y: 8.985, kind: 'online' },
  { name: 'RT-66', x: 6.154, y: 10.675, kind: 'agup' },
  { name: 'RT-18', x: 6.958, y: 10.713, kind: 'online' },
  { name: 'RT-23', x: 5.268, y: 11.033, kind: 'online' },
  { name: 'RT-02', x: 6.302, y: 11.732, kind: 'online' },
  { name: 'RT-31', x: 6.969, y: 12.433, kind: 'online' },
  { name: 'RT-70', x: 6.267, y: 13.002, kind: 'agup' },
];

/** Wells north of CPF-1 / the highway on the photograph, plus their close neighbours. */
export const NORTH_WELL_NAMES = [
  'RT-13', 'RT-56', 'RT-50', 'RT-45', 'RT-34', 'RT-03', 'RT-10',
  'RT-72', 'RT-79', 'RT-17', 'RT-29', 'RT-71', 'RT-24', 'RT-04',
] as const;

/** Wells along the southern spine of the photograph. */
export const SOUTH_WELL_NAMES = [
  'RT-15', 'RT-21', 'RT-20', 'RT-63', 'RT-48', 'RT-36', 'RT-14',
  'RT-66', 'RT-18', 'RT-23', 'RT-02', 'RT-31', 'RT-70',
] as const;

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
