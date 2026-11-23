/**
 * Everything on the hall screen a viewer can click to inspect, plus the named
 * camera viewpoints (keys 1 to 5). Positions come from world.ts, so they always
 * line up with the procedural geometry and the GLB models placed on top of it.
 * Live values are read from the same SceneState the HUD shows.
 */
import {
  AG25_WORLD,
  AGUP_WELLS,
  CPF_WORLD,
  EXPORT_LINE_WORLD,
  ONLINE_WELLS,
  SPP_WORLD,
  WORLD_WELLS,
  heightAt,
  pathPoints,
  polygonBounds,
  type Vec2,
} from '../world';
import { cameraAt, type CameraState, type SceneState } from '../ceremonyTimeline';
import { GAS_MIN_TO_OPERATE_MMSCFD, TARGET_KBOPD } from '../../data/defaults';
import { WELLS as WELL_CONFIG } from '../../data/ceremonyConfig';

export type V3 = [number, number, number];

export type HitShape =
  | { type: 'box'; size: V3 }
  | { type: 'cylinder'; radius: number; height: number }
  | { type: 'tubes'; paths: V3[][]; radius: number };

export type AssetTone = 'ok' | 'standby' | 'gold' | 'gas' | 'info';

export type AssetRow = { k: string; v: string; unit?: string };

export type InspectAsset = {
  id: string;
  name: string;
  role: string;
  /** Ground-level centre in world units. */
  center: V3;
  /** Rough radius for the highlight ring and camera framing. */
  radius: number;
  hit: HitShape;
  /** How the camera frames this asset when clicked. */
  view: CameraState;
  status: (s: SceneState) => { label: string; tone: AssetTone };
  rows: (s: SceneState) => AssetRow[];
};

const f1 = (n: number) => n.toFixed(1);
const f0 = (n: number) => Math.round(n).toString();

function ground([x, z]: Vec2, lift = 0): V3 {
  return [x, heightAt(x, z) + lift, z];
}

/**
 * A camera looking at `target` from `dist` away. `azDeg` 0 looks from the
 * west (the show camera's side), 90 from the south; `elDeg` is the height angle.
 */
export function frameFrom(target: V3, dist: number, elDeg: number, azDeg: number, fov = 32): CameraState {
  const el = (elDeg * Math.PI) / 180;
  const az = (azDeg * Math.PI) / 180;
  return {
    position: [
      target[0] - Math.cos(az) * Math.cos(el) * dist,
      target[1] + Math.sin(el) * dist,
      target[2] + Math.sin(az) * Math.cos(el) * dist,
    ],
    target,
    fov,
  };
}

const agupOnline = (s: SceneState) => s.wells > WELL_CONFIG.online + 0.5;
const gasOperating = (s: SceneState) => s.gas >= GAS_MIN_TO_OPERATE_MMSCFD;
const perWell = (s: SceneState) => (s.wells > 0 ? s.oil / s.wells : 0);

function wellAsset(w: (typeof WORLD_WELLS)[number]): InspectAsset {
  const center = ground(w.world);
  const isAgup = w.kind === 'agup';
  return {
    id: `well-${w.name}`,
    name: w.name,
    role: isAgup ? 'AGUP Phase 1 well · ESP lift' : 'Producing well · gathering line to CPF-1',
    center,
    radius: 1.2,
    hit: { type: 'cylinder', radius: 1.1, height: 2.4 },
    view: frameFrom([center[0], center[1] + 0.6, center[2]], 9, 28, 30, 34),
    status: (s) => {
      if (!isAgup) return { label: 'Online', tone: 'ok' };
      if (s.agupIgnite >= 2 && agupOnline(s)) return { label: 'Online', tone: 'gold' };
      if (s.agupIgnite >= 1) return { label: 'Opening', tone: 'gold' };
      return { label: 'Ready', tone: 'standby' };
    },
    rows: (s) => {
      const flowing = !isAgup || (s.agupIgnite >= 2 && agupOnline(s));
      return [
        { k: 'Average rate per well', v: flowing ? f1(perWell(s)) : '0.0', unit: 'kbopd' },
        { k: 'Field wells online', v: f0(s.wells), unit: `of ${WELL_CONFIG.total}` },
        { k: 'Flows to', v: 'CPF-1' },
      ];
    },
  };
}

const cpfCenter = ground(CPF_WORLD);
const ag25Center = ground(AG25_WORLD);
const flareCenter = ground([CPF_WORLD[0] - 6.4, CPF_WORLD[1] + 4.6]);

const exportPath = pathPoints([CPF_WORLD, ...EXPORT_LINE_WORLD.slice(1)], 0.25) as V3[];
const exportEnd = EXPORT_LINE_WORLD[EXPORT_LINE_WORLD.length - 1];
const exportMid = exportPath[Math.floor(exportPath.length / 2)];
const gasPath = pathPoints(
  [CPF_WORLD, [CPF_WORLD[0] + 2.2, CPF_WORLD[1] - 4.4], [AG25_WORLD[0] - 1.0, AG25_WORLD[1] + 3.0], AG25_WORLD],
  0.55,
) as V3[];
const gatheringPaths = ONLINE_WELLS.map((w) => pathPoints([w.world, w.parentWorld], 0.14) as V3[]);
const agupPaths = AGUP_WELLS.map((w) => pathPoints([w.world, w.parentWorld], 0.14) as V3[]);

function centroid(points: readonly Vec2[]): Vec2 {
  const sx = points.reduce((s, p) => s + p[0], 0);
  const sz = points.reduce((s, p) => s + p[1], 0);
  return [sx / points.length, sz / points.length];
}
const agupCentroid = ground(centroid(AGUP_WELLS.map((w) => w.world)));
const sppBounds = polygonBounds(SPP_WORLD);
const sppCenter = ground(centroid(SPP_WORLD));

export const FACILITY_ASSETS: InspectAsset[] = [
  {
    id: 'cpf1',
    name: 'CPF-1',
    role: 'Central processing facility · separation, storage and export',
    center: cpfCenter,
    radius: 8,
    hit: { type: 'box', size: [15.5, 7.3, 12.7] },
    // From the north-west so AG-25 (south-west of CPF-1) does not stand in front.
    view: frameFrom([cpfCenter[0] + 0.5, cpfCenter[1] + 1.2, cpfCenter[2]], 30, 30, -40),
    status: (s) =>
      s.oil >= TARGET_KBOPD - 1e-6
        ? { label: 'Above 120 target', tone: 'gold' }
        : s.valves > 0.5
          ? { label: 'Receiving · inlet valves open', tone: 'ok' }
          : { label: 'Receiving', tone: 'ok' },
    rows: (s) => [
      { k: 'Oil in', v: f1(s.oil), unit: 'kbopd' },
      { k: 'Wells online', v: f0(s.wells), unit: `of ${WELL_CONFIG.total}` },
      { k: 'Oil export', v: f1(s.exportKbopd), unit: 'kbopd' },
      { k: 'Gas to AG-25', v: f0(s.gas), unit: 'MMscfd' },
      { k: 'Plant efficiency', v: f1(s.efficiency), unit: '%' },
    ],
  },
  {
    id: 'ag25',
    name: 'AG-25',
    role: 'Associated gas plant · compression and dehydration',
    center: ag25Center,
    radius: 6,
    hit: { type: 'box', size: [11.2, 5.4, 7.9] },
    view: frameFrom([ag25Center[0], ag25Center[1] + 1.2, ag25Center[2]], 24, 30, 35),
    status: (s) =>
      gasOperating(s)
        ? { label: 'Operating', tone: 'gas' }
        : s.gas > 0
          ? { label: 'Ramping up', tone: 'gas' }
          : { label: 'Standby', tone: 'standby' },
    rows: (s) => [
      { k: 'Gas in', v: f0(s.gas), unit: 'MMscfd' },
      { k: 'Needs to operate', v: f0(GAS_MIN_TO_OPERATE_MMSCFD), unit: 'MMscfd' },
      { k: 'Source', v: 'CPF-1 associated gas' },
    ],
  },
  {
    id: 'flare',
    name: 'CPF-1 flare',
    role: 'Flare stack · pilot lit, safe relief for CPF-1',
    center: flareCenter,
    radius: 2,
    hit: { type: 'cylinder', radius: 1.2, height: 7 },
    view: frameFrom([flareCenter[0], flareCenter[1] + 3, flareCenter[2]], 14, 18, 40, 34),
    status: () => ({ label: 'Pilot lit', tone: 'ok' }),
    rows: (s) => [
      { k: 'Gas routed to AG-25', v: f0(s.gas), unit: 'MMscfd' },
      { k: 'Status', v: gasOperating(s) ? 'Minimal flaring' : 'Standby flaring' },
    ],
  },
  {
    id: 'gas-line',
    name: 'Gas line to AG-25',
    role: 'Associated gas pipeline · CPF-1 to AG-25',
    center: gasPath[Math.floor(gasPath.length / 2)],
    radius: 6,
    hit: { type: 'tubes', paths: [gasPath], radius: 0.7 },
    view: frameFrom(gasPath[Math.floor(gasPath.length / 2)], 26, 40, 30),
    status: (s) => (s.gasFlow > 0.05 ? { label: 'Flowing', tone: 'gas' } : { label: 'Standby', tone: 'standby' }),
    rows: (s) => [
      { k: 'Gas flow', v: f0(s.gas), unit: 'MMscfd' },
      { k: 'AG-25 needs', v: f0(GAS_MIN_TO_OPERATE_MMSCFD), unit: 'MMscfd' },
    ],
  },
  {
    id: 'export-line',
    name: 'Export line',
    role: 'Crude export pipeline · CPF-1 to the export tie-in',
    center: exportMid,
    radius: 12,
    hit: { type: 'tubes', paths: [exportPath], radius: 0.8 },
    view: frameFrom(exportMid, 44, 32, 70),
    status: () => ({ label: 'Exporting · metered', tone: 'ok' }),
    rows: (s) => [
      { k: 'Oil export', v: f1(s.exportKbopd), unit: 'kbopd' },
      { k: 'BSW', v: s.bsw.toFixed(2), unit: '%' },
      { k: 'Salt content', v: f0(s.salt), unit: 'mg/l' },
    ],
  },
  {
    id: 'gathering',
    name: 'Gathering network',
    role: 'Oil flowlines from the producing wells to CPF-1',
    center: cpfCenter,
    radius: 30,
    hit: { type: 'tubes', paths: gatheringPaths, radius: 0.45 },
    view: cameraAt(0),
    status: (s) => ({ label: s.oilFlow > 0.5 ? 'Full flow' : 'Flowing', tone: 'ok' }),
    rows: (s) => [
      { k: 'Producing wells', v: f0(WELL_CONFIG.online) },
      { k: 'Oil to CPF-1', v: f1(s.oil), unit: 'kbopd' },
    ],
  },
  {
    id: 'agup-lines',
    name: 'AGUP flowlines',
    role: 'New flowlines from the 7 AGUP wells to CPF-1',
    center: agupCentroid,
    radius: 22,
    hit: { type: 'tubes', paths: agupPaths, radius: 0.45 },
    view: frameFrom(agupCentroid, 70, 48, 20, 30),
    status: (s) =>
      s.agupFlow > 0.95 ? { label: 'Flowing', tone: 'gold' } : s.agupFlow > 0 ? { label: 'Filling', tone: 'gold' } : { label: 'Ready', tone: 'standby' },
    rows: (s) => [
      { k: 'AGUP wells online', v: f0(Math.max(0, s.wells - WELL_CONFIG.online)), unit: 'of 7' },
      { k: 'Flow progress', v: f0(s.agupFlow * 100), unit: '%' },
    ],
  },
  {
    id: 'spp',
    name: 'SPP',
    role: 'Solar power project · field power supply',
    center: sppCenter,
    radius: Math.max(sppBounds.maxX - sppBounds.minX, sppBounds.maxZ - sppBounds.minZ) / 2,
    hit: { type: 'box', size: [sppBounds.maxX - sppBounds.minX, 1.2, sppBounds.maxZ - sppBounds.minZ] },
    view: frameFrom(sppCenter, 40, 45, 20, 32),
    status: () => ({ label: 'In service', tone: 'info' }),
    rows: () => [{ k: 'Footprint', v: 'North of CPF-1' }],
  },
];

export const WELL_ASSETS: InspectAsset[] = WORLD_WELLS.map(wellAsset);

export const ALL_ASSETS: InspectAsset[] = [...FACILITY_ASSETS, ...WELL_ASSETS];

const BY_ID = new Map(ALL_ASSETS.map((a) => [a.id, a]));
export function assetById(id: string | null | undefined): InspectAsset | undefined {
  return id ? BY_ID.get(id) : undefined;
}

export type ViewPreset = { id: string; key: string; label: string; camera: CameraState };

export const VIEW_PRESETS: ViewPreset[] = [
  { id: 'aerial', key: '1', label: 'Aerial', camera: cameraAt(0) },
  { id: 'cpf1', key: '2', label: 'CPF-1', camera: FACILITY_ASSETS[0].view },
  { id: 'ag25', key: '3', label: 'AG-25 gas plant', camera: FACILITY_ASSETS[1].view },
  { id: 'agup', key: '4', label: 'AGUP wells', camera: frameFrom(agupCentroid, 70, 48, 20, 30) },
  { id: 'export', key: '5', label: 'Export line', camera: frameFrom(ground(exportEnd, 0), 46, 30, 120, 32) },
];

export function presetById(id: string): ViewPreset | undefined {
  return VIEW_PRESETS.find((p) => p.id === id);
}
