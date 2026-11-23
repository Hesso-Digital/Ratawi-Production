/**
 * The hall camera with free roam layered on top of the cinematic rig.
 *
 * show       every frame copies the keyframed drone camera (ceremonyTimeline.ts),
 *            exactly as before, so /operator cues look identical.
 * explore    starts on the first drag / wheel / pinch, the E key or the Explore
 *            chip: drei OrbitControls with damping, pan on the ground plane,
 *            distance and polar limits, and the orbit target clamped to the field.
 *            Clicking an asset or a viewpoint (keys 1 to 8) flies there with GSAP.
 * returning  R, "Back to show", a new /operator cue, or about 20 s without input
 *            eases from wherever the viewer is back onto the live show camera.
 */
import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import gsap from 'gsap';
import { useEffect, useRef } from 'react';
import { MathUtils, Vector3, type PerspectiveCamera } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { heightAt } from '../world';
import { useSceneClockRef } from '../useSceneClock';
import type { CameraState } from '../ceremonyTimeline';
import { assetById, presetById } from './assets';
import { flySecondsFor } from './areas';
import { fitCameraOffset } from '../viewportFit';
import { exploreStore, type ExploreMode } from './exploreStore';
import { attachTourInterrupts, fieldTour } from './fieldTour';
import { sceneSettings } from '../../state/sceneSettings';
import { buildFieldTourTimeline } from './fieldTourShots';
import { publishHeading } from './heading';

/** Fall back to the show's slow drift after this long without input. */
export const EXPLORE_IDLE_MS = 20_000;
/** A little longer while an info panel is open, so it can be read. */
const EXPLORE_IDLE_PANEL_MS = 40_000;

const TARGET_BOUNDS = { minX: -78, maxX: 78, minZ: -70, maxZ: 70, minY: -2, maxY: 24 };
const RETURN_S = 1.6;

const tmpTarget = new Vector3();

type Cam = { p: Vector3; t: Vector3; fov: number };

function fromState(c: CameraState): Cam {
  return { p: new Vector3(...c.position), t: new Vector3(...c.target), fov: c.fov };
}

function lerpCam(a: Cam, b: Cam, k: number, out: Cam): Cam {
  out.p.lerpVectors(a.p, b.p, k);
  out.t.lerpVectors(a.t, b.t, k);
  out.fov = a.fov + (b.fov - a.fov) * k;
  return out;
}

/** Linear lerp plus a mid-move height arc so area-to-area moves feel like a dolly, not a slide. */
function arcCam(a: Cam, b: Cam, k: number, lift: number, out: Cam): Cam {
  lerpCam(a, b, k, out);
  out.p.y += Math.sin(Math.PI * k) * lift;
  return out;
}

function arcLiftBetween(a: Cam, b: Cam): number {
  return MathUtils.clamp(a.p.distanceTo(b.p) * 0.18, 4, 16);
}

export function ExploreCameraRig({
  debugOrbit,
  override,
  cueKey,
  locked,
}: {
  debugOrbit: boolean;
  /** A fixed framing for a specific frame preset (F5/F6 close-ups), bypassing the keyframed rig. */
  override?: CameraState;
  /** Changes whenever /operator fires a cue; the show camera then takes the view back. */
  cueKey: string;
  /** `?locked=1`: the original display-only camera, no free roam. */
  locked: boolean;
}) {
  const sceneClock = useSceneClockRef();
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const controls = useRef<OrbitControlsImpl>(null);

  const mode = useRef<ExploreMode>(debugOrbit ? 'explore' : 'show');
  const lastInput = useRef(performance.now());
  const returnFrom = useRef<Cam>({ p: new Vector3(), t: new Vector3(), fov: 30 });
  const returnK = useRef(0);
  const tween = useRef<gsap.core.Tween | null>(null);
  const tourTl = useRef<gsap.core.Timeline | null>(null);
  const flying = useRef(false);
  const scratch = useRef<Cam>({ p: new Vector3(), t: new Vector3(), fov: 30 });
  const overrideRef = useRef(override);
  overrideRef.current = override;

  const setMode = (m: ExploreMode) => {
    mode.current = m;
    exploreStore.setMode(m);
  };

  const showCam = (): Cam => fromState(overrideRef.current ?? sceneClock.current.camera);

  const current = (): Cam => ({
    p: camera.position.clone(),
    t: controls.current ? controls.current.target.clone() : showCam().t,
    fov: camera.fov,
  });

  const fitted = useRef<Cam>({ p: new Vector3(), t: new Vector3(), fov: 30 });

  /** Pull a designed 16:9 camera back in tall/narrow viewports so the field still fits. */
  const fitDesign = (c: Cam): Cam => {
    const f = fitCameraOffset(c.p.x, c.p.y, c.p.z, c.t.x, c.t.y, c.t.z, c.fov, camera.aspect);
    fitted.current.p.set(f.position[0], f.position[1], f.position[2]);
    fitted.current.t.copy(c.t);
    fitted.current.fov = f.fov;
    return fitted.current;
  };

  const apply = (c: Cam) => {
    camera.position.copy(c.p);
    controls.current?.target.copy(c.t);
    camera.lookAt(c.t);
    if (Math.abs(camera.fov - c.fov) > 1e-3) {
      camera.fov = c.fov;
      camera.updateProjectionMatrix();
    }
  };

  const killTween = () => {
    tween.current?.kill();
    tween.current = null;
    tourTl.current?.kill();
    tourTl.current = null;
    flying.current = false;
    sceneSettings.releaseHudDim('motion');
    if (controls.current) controls.current.enableDamping = true;
  };

  const endTourTakeover = () => {
    tourTl.current?.kill();
    tourTl.current = null;
    if (!tween.current) {
      flying.current = false;
      if (controls.current) {
        controls.current.enableDamping = true;
        controls.current.update();
      }
    }
    lastInput.current = performance.now();
  };

  const startTour = () => {
    killTween();
    setMode('explore');
    lastInput.current = performance.now();
    flying.current = true;
    if (controls.current) controls.current.enableDamping = false;
    const getAspect = () => {
      const el = gl.domElement;
      const w = el?.clientWidth || size.width || 1;
      const h = el?.clientHeight || size.height || 1;
      return w / Math.max(1, h);
    };
    tourTl.current = buildFieldTourTimeline({
      getCurrent: () => {
        const c = current();
        return { position: [c.p.x, c.p.y, c.p.z], target: [c.t.x, c.t.y, c.t.z], fov: c.fov };
      },
      apply: (cam) => apply(fromState(cam)),
      getAspect,
      onCaption: (caption, areaId) => {
        fieldTour.setCaption(caption);
        exploreStore.focusArea(areaId);
        lastInput.current = performance.now();
      },
      onComplete: () => {
        tourTl.current = null;
        flying.current = false;
        if (controls.current) controls.current.enableDamping = true;
        lastInput.current = performance.now();
        exploreStore.focusArea('aerial');
        fieldTour.stop();
      },
    });
    tourTl.current.play();
  };

  const enterExplore = () => {
    lastInput.current = performance.now();
    if (fieldTour.get().playing) fieldTour.stop();
    if (mode.current === 'explore') return;
    killTween();
    setMode('explore');
  };

  const flyTo = (dest: CameraState, kind: 'preset' | 'asset' = 'asset', id?: string) => {
    if (fieldTour.get().playing) fieldTour.stop();
    killTween();
    setMode('explore');
    lastInput.current = performance.now();
    const a = current();
    const b = fitDesign(fromState(dest));
    const motion = flySecondsFor(kind, id);
    const lift = motion.arc ? arcLiftBetween(a, b) : 0;
    const o = { k: 0 };
    flying.current = true;
    sceneSettings.requestHudDim('motion');
    if (controls.current) controls.current.enableDamping = false;
    tween.current = gsap.to(o, {
      k: 1,
      duration: motion.duration,
      ease: 'power2.inOut',
      onUpdate: () => apply(arcCam(a, b, o.k, lift, scratch.current)),
      onComplete: () => {
        flying.current = false;
        sceneSettings.releaseHudDim('motion');
        tween.current = null;
        if (controls.current) controls.current.enableDamping = true;
        lastInput.current = performance.now();
      },
    });
  };


  const orientNorth = () => {
    if (fieldTour.get().playing) fieldTour.stop();
    killTween();
    setMode('explore');
    lastInput.current = performance.now();
    const a = current();
    const ox = a.p.x - a.t.x;
    const oz = a.p.z - a.t.z;
    const horiz = Math.hypot(ox, oz) || 1e-4;
    const start = Math.atan2(ox, oz);
    const end = 0; // camera sits on +Z of the target, looking toward −Z (north)
    let delta = end - start;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    const o = { k: 0 };
    flying.current = true;
    sceneSettings.requestHudDim('motion');
    if (controls.current) controls.current.enableDamping = false;
    tween.current = gsap.to(o, {
      k: 1,
      duration: 0.8,
      ease: 'power2.inOut',
      onUpdate: () => {
        const ang = start + delta * o.k;
        scratch.current.p.set(a.t.x + Math.sin(ang) * horiz, a.p.y, a.t.z + Math.cos(ang) * horiz);
        scratch.current.t.copy(a.t);
        scratch.current.fov = a.fov;
        apply(scratch.current);
      },
      onComplete: () => {
        flying.current = false;
        tween.current = null;
        if (controls.current) controls.current.enableDamping = true;
        lastInput.current = performance.now();
      },
    });
  };

  const startReturn = () => {
    if (fieldTour.get().playing) fieldTour.stop();
    if (mode.current === 'show' || mode.current === 'returning' || debugOrbit) return;
    killTween();
    returnFrom.current = current();
    returnK.current = 0;
    setMode('returning');
    sceneSettings.requestHudDim('motion');
    const o = { k: 0 };
    tween.current = gsap.to(o, {
      k: 1,
      duration: RETURN_S,
      ease: 'power2.inOut',
      onUpdate: () => {
        returnK.current = o.k;
      },
      onComplete: () => {
        tween.current = null;
        sceneSettings.releaseHudDim('motion');
        setMode('show');
      },
    });
  };

  // Store-driven requests: Explore chip / E, Back to show / R, viewpoints and inspect flights.
  useEffect(() => {
    if (locked) return;
    let prev = exploreStore.get();
    return exploreStore.subscribe(() => {
      const s = exploreStore.get();
      if (s.exploreSeq !== prev.exploreSeq) enterExplore();
      if (s.northUpSeq !== prev.northUpSeq) orientNorth();
      if (s.returnSeq !== prev.returnSeq) startReturn();
      if (s.fly && s.fly !== prev.fly) {
        const f = s.fly;
        if (f.kind === 'camera') flyTo(f.camera, 'preset');
        else {
          const dest = f.kind === 'preset' ? presetById(f.id)?.camera : assetById(f.id)?.view;
          if (dest) flyTo(dest, f.kind, f.id);
        }
      }
      // Any panel / chart interaction keeps free roam alive.
      lastInput.current = performance.now();
      prev = s;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked]);

  useEffect(() => {
    if (locked) return;
    let prev = fieldTour.get();
    return fieldTour.subscribe(() => {
      const s = fieldTour.get();
      if (s.startSeq !== prev.startSeq && s.playing) startTour();
      if (s.stopSeq !== prev.stopSeq) endTourTakeover();
      prev = s;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked]);

  useEffect(() => {
    if (locked) return;
    const handle = attachTourInterrupts(window, {
      isPlaying: () => fieldTour.get().playing,
      onStop: () => fieldTour.stop(),
    });
    return () => handle.stop();
  }, [locked]);

  // A new /operator cue: the show camera takes over again (and the panel closes).
  const firstCue = useRef(true);
  useEffect(() => {
    if (firstCue.current) {
      firstCue.current = false;
      return;
    }
    exploreStore.select(null);
    exploreStore.hover(null);
    exploreStore.openKpi(null);
    startReturn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cueKey]);

  useEffect(
    () => () => {
      killTween();
      if (fieldTour.get().playing) fieldTour.stop();
    },
    [],
  );

  // Screen position of an asset, for the e2e explore spec (e2e/explore.spec.ts).
  useEffect(() => {
    const w = window as unknown as { __ratawiExplore?: unknown };
    w.__ratawiExplore = {
      project(id: string) {
        const a = assetById(id);
        if (!a) return null;
        const v = new Vector3(a.center[0], a.center[1] + 1, a.center[2]).project(camera);
        const r = gl.domElement.getBoundingClientRect();
        return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
      },
      mode: () => mode.current,
    };
    return () => {
      delete w.__ratawiExplore;
    };
  }, [camera, gl]);
  useEffect(() => () => exploreStore.reset(), []);

  const writeHeading = () => {
    const t = controls.current?.target ?? showCam().t;
    publishHeading(camera.position.x, camera.position.z, t.x, t.z);
  };

  useFrame(() => {
    if (locked || (debugOrbit && mode.current === 'explore' && !flying.current)) {
      if (locked) apply(fitDesign(showCam()));
      writeHeading();
      return;
    }
    if (fieldTour.get().playing) {
      lastInput.current = performance.now();
      writeHeading();
      return;
    }
    const m = mode.current;
    if (m === 'show') {
      apply(fitDesign(showCam()));
      writeHeading();
      return;
    }
    if (m === 'returning') {
      apply(lerpCam(returnFrom.current, fitDesign(showCam()), returnK.current, scratch.current));
      writeHeading();
      return;
    }
    // explore: keep the orbit target on the field and the camera above the dunes.
    const c = controls.current;
    if (c && !flying.current) {
      tmpTarget.copy(c.target);
      c.target.set(
        MathUtils.clamp(tmpTarget.x, TARGET_BOUNDS.minX, TARGET_BOUNDS.maxX),
        MathUtils.clamp(tmpTarget.y, TARGET_BOUNDS.minY, TARGET_BOUNDS.maxY),
        MathUtils.clamp(tmpTarget.z, TARGET_BOUNDS.minZ, TARGET_BOUNDS.maxZ),
      );
      const floor = heightAt(camera.position.x, camera.position.z) + 1.2;
      if (camera.position.y < floor) camera.position.y = floor;
    }
    const idleFor = performance.now() - lastInput.current;
    const st = exploreStore.get();
    const limit = st.selectedId || st.kpiId ? EXPLORE_IDLE_PANEL_MS : EXPLORE_IDLE_MS;
    // A showpiece view (exploded layers, production ribbon) holds its framing until it is closed.
    if (!flying.current && idleFor > limit && sceneSettings.get().viewMode === 'field') {
      exploreStore.select(null);
      exploreStore.hover(null);
      exploreStore.openKpi(null);
      startReturn();
    }
    writeHeading();
  });

  if (locked) return null;

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.6}
      zoomSpeed={0.9}
      panSpeed={0.9}
      screenSpacePanning={false}
      minDistance={4}
      maxDistance={480}
      minPolarAngle={0.12}
      maxPolarAngle={1.36}
      target={debugOrbit ? showCam().t : undefined}
      onStart={() => {
        enterExplore();
        sceneSettings.requestHudDim('motion');
      }}
      onEnd={() => {
        lastInput.current = performance.now();
        sceneSettings.releaseHudDim('motion');
      }}
    />
  );
}
