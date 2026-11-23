/**
 * Data tags anchored to scene assets (CPF-1, AG-25, AGUP wells, export line,
 * the concession). Small chips with a hairline stem (styles/scene-tags.css)
 * so they never cover the models: each frame the tag scales with camera
 * distance (full size close up, about 60% from the aerial view) and the
 * secondary tags fade out with distance, so only the plant tags stay when the
 * whole field is on screen.
 */
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef, type ReactNode } from 'react';
import { Vector3 } from 'three';
import { AG25_WORLD, AGUP_WELLS, CONCESSION_WORLD, CPF_WORLD, EXPORT_LINE_WORLD, heightAt } from './world';
import { useSceneSnapshot } from './useSceneClock';
import { tagStyleForDistance } from './look/tagStyle';
import '../styles/scene-tags.css';

function at(x: number, z: number, lift: number): [number, number, number] {
  return [x, heightAt(x, z) + lift, z];
}

function centroidOf(points: ReadonlyArray<{ world: readonly [number, number] }>): [number, number] {
  let x = 0;
  let z = 0;
  for (const p of points) {
    x += p.world[0];
    z += p.world[1];
  }
  const n = points.length || 1;
  return [x / n, z / n];
}

const agupCentroid = centroidOf(AGUP_WELLS);

function SceneTag({ position, primary = false, tone, children }: { position: [number, number, number]; primary?: boolean; tone?: 'amber' | 'red'; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const p = useRef(new Vector3(...position));
  p.current.set(...position);
  useFrame(({ camera }) => {
    const el = ref.current;
    if (!el) return;
    const { scale, opacity } = tagStyleForDistance(camera.position.distanceTo(p.current), primary);
    el.style.transform = `scale(${scale.toFixed(3)})`;
    el.style.opacity = opacity.toFixed(2);
    el.style.visibility = opacity < 0.03 ? 'hidden' : 'visible';
  });
  return (
    <Html zIndexRange={[3, 0]} position={position} center={false} occlude={false} pointerEvents="none">
      <div ref={ref} className="scene-tag-anchor">
        <div className={`scene-tag${tone ? ` ${tone}` : ''}`}>{children}</div>
      </div>
    </Html>
  );
}

export function AnchoredTags() {
  const state = useSceneSnapshot();
  const agupLabel =
    state.agupIgnite === 0 ? 'Ready' : state.agupIgnite === 1 ? 'Armed' : `${Math.max(0, Math.round(state.wells) - 25)} / 7 online`;

  return (
    <>
      <SceneTag position={at(CPF_WORLD[0] - 1, CPF_WORLD[1] - 2.5, 4.2)} primary>
        <span className="k">CPF-1</span>
        <span className="v">
          {state.oil.toFixed(1)}
          <small>kbopd</small>
        </span>
      </SceneTag>
      <SceneTag position={at(AG25_WORLD[0] - 1, AG25_WORLD[1], 3.8)} primary tone={state.gas > 0 ? 'amber' : undefined}>
        <span className="k">AG-25</span>
        <span className="v">
          {state.gas > 0 ? (
            <>
              {state.gas.toFixed(0)}
              <small>MMscfd</small>
            </>
          ) : (
            'Standby'
          )}
        </span>
      </SceneTag>
      <SceneTag position={at(agupCentroid[0], agupCentroid[1], 2.6)} tone="amber">
        <span className="k">AGUP wells</span>
        <span className="v">{agupLabel}</span>
      </SceneTag>
      <SceneTag position={at(EXPORT_LINE_WORLD[3][0], EXPORT_LINE_WORLD[3][1], 1.2)}>
        <span className="k">Export</span>
        <span className="v">
          {state.exportKbopd.toFixed(0)}
          <small>kbopd</small>
        </span>
      </SceneTag>
      <SceneTag position={at(CONCESSION_WORLD[4][0], CONCESSION_WORLD[4][1], 2.6)} tone="red">
        <span className="k">Ratawi concession</span>
      </SceneTag>
    </>
  );
}
