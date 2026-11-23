/**
 * Shot list and GSAP timeline for the field tour. Durations land in the
 * 45–75 s range at normal motion; reduced motion skips orbits and shortens
 * the flies. Every pose is run through adaptView() for the live aspect.
 */
import gsap from 'gsap';
import { AGUP_WELLS, EXPORT_LINE_WORLD, heightAt } from '../world';
import type { CameraState } from '../ceremonyTimeline';
import { frameFrom, wellInspectView } from './wellCamera';
import { presetById, VIEW_PRESETS } from './assets';
import { adaptView } from './fieldTour';
import { prefersReducedMotion } from './areas';

export type FieldTourTimelineOpts = {
  getCurrent: () => CameraState;
  apply: (cam: CameraState) => void;
  getAspect: () => number;
  reducedMotion?: boolean;
  onCaption: (caption: string, areaId: string | null) => void;
  onComplete: () => void;
};

type Shot =
  | { kind: 'fly'; caption: string; areaId: string; view: CameraState; duration: number; ease: string }
  | {
      kind: 'orbit';
      caption: string;
      areaId: string;
      target: [number, number, number];
      dist: number;
      elDeg: number;
      fromAz: number;
      toAz: number;
      fov: number;
      duration: number;
    }
  | { kind: 'path'; caption: string; areaId: string; views: CameraState[]; duration: number; ease: string };

function preset(id: string): CameraState {
  const p = presetById(id);
  if (!p) throw new Error(`Missing view preset: ${id}`);
  return p.camera;
}

function groundLift(x: number, z: number, y: number): [number, number, number] {
  return [x, heightAt(x, z) + y, z];
}

function wellCloseUp(name: string): CameraState {
  const w = AGUP_WELLS.find((well) => well.name === name) ?? AGUP_WELLS[0];
  const center: [number, number, number] = [w.world[0], heightAt(w.world[0], w.world[1]), w.world[1]];
  return wellInspectView(center);
}

function exportSweepViews(): CameraState[] {
  const pts = EXPORT_LINE_WORLD;
  const views: CameraState[] = [];
  for (let i = 0; i < pts.length; i++) {
    const [x, z] = pts[i];
    const next = pts[Math.min(pts.length - 1, i + 1)];
    const dx = next[0] - x;
    const dz = next[1] - z;
    const az = (Math.atan2(dz, -dx) * 180) / Math.PI + 70;
    views.push(frameFrom(groundLift(x, z, 1.2), 28, 16, az, 34));
  }
  return views;
}

function midFieldApproach(): CameraState {
  // Crane/dolly from the high aerial toward mid-field, still above CPF-1.
  return { position: [-58, 40, 40], target: [-2, 0.4, 4], fov: 31 };
}

export function buildTourShots(): Shot[] {
  const aerial = preset('aerial');
  const cpf = preset('cpf1');
  const ag25 = preset('ag25');
  const agup = preset('agup');
  const spp = preset('spp');
  const north = preset('north');
  const south = preset('south');
  const well = wellCloseUp('RT-60');
  const cpfTarget = cpf.target;
  const ag25Target = ag25.target;
  const sppTarget = spp.target;
  const wellTarget = well.target;
  const aerialDist = Math.hypot(aerial.position[0] - aerial.target[0], aerial.position[2] - aerial.target[2]);
  const aerialEl = (Math.atan2(aerial.position[1] - aerial.target[1], aerialDist) * 180) / Math.PI;
  const aerialAz = (Math.atan2(aerial.position[2] - aerial.target[2], -(aerial.position[0] - aerial.target[0])) * 180) / Math.PI;

  return [
    { kind: 'fly', caption: 'Whole field', areaId: 'aerial', view: aerial, duration: 3.0, ease: 'power2.inOut' },
    {
      kind: 'orbit',
      caption: 'Whole field',
      areaId: 'aerial',
      target: aerial.target,
      dist: Math.hypot(aerial.position[0] - aerial.target[0], aerial.position[1] - aerial.target[1], aerial.position[2] - aerial.target[2]),
      elDeg: aerialEl,
      fromAz: aerialAz,
      toAz: aerialAz + 200,
      fov: aerial.fov,
      duration: 11.0,
    },
    { kind: 'fly', caption: 'Whole field', areaId: 'aerial', view: midFieldApproach(), duration: 3.0, ease: 'power2.inOut' },
    { kind: 'fly', caption: 'CPF-1', areaId: 'cpf1', view: cpf, duration: 2.5, ease: 'power2.inOut' },
    {
      kind: 'orbit',
      caption: 'CPF-1',
      areaId: 'cpf1',
      target: cpfTarget,
      dist: 30,
      elDeg: 22,
      fromAz: -40,
      toAz: -40 + 220,
      fov: 32,
      duration: 7.0,
    },
    { kind: 'fly', caption: 'AG-25', areaId: 'ag25', view: ag25, duration: 2.2, ease: 'power2.inOut' },
    {
      kind: 'orbit',
      caption: 'AG-25',
      areaId: 'ag25',
      target: ag25Target,
      dist: 24,
      elDeg: 24,
      fromAz: 35,
      toAz: 35 + 160,
      fov: 32,
      duration: 5.0,
    },
    { kind: 'fly', caption: 'AGUP wells', areaId: 'agup', view: agup, duration: 2.5, ease: 'power2.inOut' },
    { kind: 'fly', caption: 'AGUP well RT-60', areaId: 'agup', view: well, duration: 3.0, ease: 'power2.inOut' },
    {
      kind: 'orbit',
      caption: 'AGUP well RT-60',
      areaId: 'agup',
      target: wellTarget,
      dist: 6.5,
      elDeg: 26,
      fromAz: (Math.atan2(well.position[2] - well.target[2], -(well.position[0] - well.target[0])) * 180) / Math.PI,
      toAz:
        (Math.atan2(well.position[2] - well.target[2], -(well.position[0] - well.target[0])) * 180) / Math.PI + 80,
      fov: 34,
      duration: 3.5,
    },
    { kind: 'fly', caption: 'SPP', areaId: 'spp', view: spp, duration: 2.5, ease: 'power2.inOut' },
    {
      kind: 'orbit',
      caption: 'SPP',
      areaId: 'spp',
      target: sppTarget,
      dist: 48,
      elDeg: 40,
      fromAz: 15,
      toAz: 15 + 110,
      fov: 32,
      duration: 3.5,
    },
    { kind: 'path', caption: 'Export', areaId: 'export', views: exportSweepViews(), duration: 5.0, ease: 'power1.inOut' },
    { kind: 'fly', caption: 'North wells', areaId: 'north', view: north, duration: 2.2, ease: 'power2.inOut' },
    {
      kind: 'orbit',
      caption: 'North wells',
      areaId: 'north',
      target: north.target,
      dist: 56,
      elDeg: 38,
      fromAz: 10,
      toAz: 10 + 70,
      fov: 32,
      duration: 2.2,
    },
    { kind: 'fly', caption: 'South wells', areaId: 'south', view: south, duration: 2.2, ease: 'power2.inOut' },
    { kind: 'fly', caption: 'Whole field', areaId: 'aerial', view: aerial, duration: 4.2, ease: 'power2.inOut' },
  ];
}

export type TourDurationOpts = { reducedMotion?: boolean };

/** Scale used when the viewer prefers reduced motion: orbits are dropped, flies shrink. */
const REDUCED_FLY = 0.35;

export function shotsForMotion(reducedMotion: boolean): Shot[] {
  const shots = buildTourShots();
  if (!reducedMotion) return shots;
  return shots
    .filter((s) => s.kind === 'fly' || s.kind === 'path')
    .map((s) => ({ ...s, duration: Math.max(0.35, s.duration * REDUCED_FLY) }));
}

export function tourDuration(opts: TourDurationOpts = {}): number {
  return shotsForMotion(!!opts.reducedMotion).reduce((sum, s) => sum + s.duration, 0);
}

export function tourCaptions(): string[] {
  const seen: string[] = [];
  for (const s of buildTourShots()) {
    if (!seen.includes(s.caption)) seen.push(s.caption);
  }
  return seen;
}

function lerpView(a: CameraState, b: CameraState, k: number): CameraState {
  return {
    position: [
      a.position[0] + (b.position[0] - a.position[0]) * k,
      a.position[1] + (b.position[1] - a.position[1]) * k,
      a.position[2] + (b.position[2] - a.position[2]) * k,
    ],
    target: [
      a.target[0] + (b.target[0] - a.target[0]) * k,
      a.target[1] + (b.target[1] - a.target[1]) * k,
      a.target[2] + (b.target[2] - a.target[2]) * k,
    ],
    fov: a.fov + (b.fov - a.fov) * k,
  };
}

function liftArc(view: CameraState, k: number, lift: number): CameraState {
  if (lift <= 0) return view;
  return {
    ...view,
    position: [view.position[0], view.position[1] + Math.sin(Math.PI * k) * lift, view.position[2]],
  };
}

function poseDistance(a: CameraState, b: CameraState): number {
  const dx = a.position[0] - b.position[0];
  const dy = a.position[1] - b.position[1];
  const dz = a.position[2] - b.position[2];
  return Math.hypot(dx, dy, dz);
}

export function buildFieldTourTimeline(opts: FieldTourTimelineOpts): gsap.core.Timeline {
  const reduced = opts.reducedMotion ?? prefersReducedMotion();
  const shots = shotsForMotion(reduced);
  const tl = gsap.timeline({
    paused: true,
    onComplete: () => opts.onComplete(),
  });

  let last: CameraState = opts.getCurrent();

  const applyAdapted = (view: CameraState) => {
    opts.apply(adaptView(view, opts.getAspect()));
  };

  for (const shot of shots) {
    tl.call(() => opts.onCaption(shot.caption, shot.areaId));
    if (shot.kind === 'fly') {
      const from = last;
      const to = shot.view;
      const lift = reduced ? 0 : Math.min(16, Math.max(4, poseDistance(from, to) * 0.18));
      const o = { k: 0 };
      tl.to(o, {
        k: 1,
        duration: shot.duration,
        ease: shot.ease,
        onUpdate: () => applyAdapted(liftArc(lerpView(from, to, o.k), o.k, lift)),
      });
      last = to;
    } else if (shot.kind === 'orbit') {
      const o = { k: 0 };
      tl.to(o, {
        k: 1,
        duration: shot.duration,
        ease: 'none',
        onUpdate: () => {
          const az = shot.fromAz + (shot.toAz - shot.fromAz) * o.k;
          applyAdapted(frameFrom(shot.target, shot.dist, shot.elDeg, az, shot.fov));
        },
      });
      last = frameFrom(shot.target, shot.dist, shot.elDeg, shot.toAz, shot.fov);
    } else {
      const views = shot.views;
      const o = { k: 0 };
      tl.to(o, {
        k: 1,
        duration: shot.duration,
        ease: shot.ease,
        onUpdate: () => {
          const u = o.k * (views.length - 1);
          const i = Math.min(views.length - 2, Math.max(0, Math.floor(u)));
          const f = u - i;
          applyAdapted(lerpView(views[i], views[i + 1], f));
        },
      });
      last = views[views.length - 1];
    }
  }

  return tl;
}

/** Sanity re-export so tests can confirm we still cover every numbered area. */
export const TOUR_AREA_IDS = VIEW_PRESETS.map((p) => p.id);
