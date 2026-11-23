/**
 * Data tags anchored to scene assets (CPF-1, AG-25, AGUP wells, export line,
 * SPP, the concession), ported from design-3d/src/main.js `fieldTags`. Uses
 * drei's <Html> for 3D→screen projection instead of the prototype's manual
 * collision-avoidance algorithm (a deliberate simplification — see
 * docs/venue-rehearsal-checklist.md).
 */
import { Html } from '@react-three/drei';
import { AG25_WORLD, AGUP_WELLS, CONCESSION_WORLD, CPF_WORLD, EXPORT_LINE_WORLD, heightAt } from './world';
import { GAS_MIN_TO_OPERATE_MMSCFD } from '../data/defaults';
import { useSceneSnapshot } from './useSceneClock';

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

export function AnchoredTags() {
  const state = useSceneSnapshot();
  const gold = state.gold > 0.5;
  const agupLabel =
    state.agupIgnite === 0 ? 'Ready · 7 wells' : state.agupIgnite === 1 ? 'Armed · 7 wells' : `Online · ${Math.max(0, Math.round(state.wells) - 25)} / 7 wells`;

  return (
    <>
      <Html position={at(CPF_WORLD[0] - 1, CPF_WORLD[1] - 2.5, 4.5)} center={false} occlude={false} distanceFactor={42}>
        <div className="reveal-tag big">
          <div className="t" style={{ color: gold ? '#ffc65a' : '#9fe9ff' }}>
            CPF-1 · Central processing
          </div>
          <div className="d">
            {state.oil.toFixed(1)}
            <small>{state.valves > 0.5 ? 'kbopd in · valves open' : 'kbopd in'}</small>
          </div>
        </div>
      </Html>
      <Html position={at(AG25_WORLD[0] - 1, AG25_WORLD[1], 4.5)} center={false} occlude={false} distanceFactor={42}>
        <div className="reveal-tag">
          <div className="t">AG-25 · Gas plant</div>
          <div className="d" style={{ color: state.gas > 0 ? '#cdb6ff' : undefined }}>
            {state.gas > 0 ? (
              <>
                {state.gas.toFixed(0)}
                <small>MMscfd</small>
              </>
            ) : (
              <>
                Standby
                <small>needs ≥ {GAS_MIN_TO_OPERATE_MMSCFD} MMscfd</small>
              </>
            )}
          </div>
        </div>
      </Html>
      <Html position={at(agupCentroid[0], agupCentroid[1], 3)} center={false} occlude={false} distanceFactor={42}>
        <div className="reveal-tag">
          <div className="t" style={{ color: state.agupIgnite >= 2 ? '#ffd59a' : '#ff9a2e' }}>
            AGUP wells
          </div>
          <div className="d">{agupLabel}</div>
        </div>
      </Html>
      <Html
        position={at(EXPORT_LINE_WORLD[3][0], EXPORT_LINE_WORLD[3][1], 0.6)}
        center={false}
        occlude={false}
        distanceFactor={42}
      >
        <div className="reveal-tag sm">
          <div className="t">Export line</div>
          <div className="d">
            {state.exportKbopd.toFixed(0)}
            <small>kbopd</small>
          </div>
        </div>
      </Html>
      <Html position={at(CONCESSION_WORLD[4][0], CONCESSION_WORLD[4][1], 2.6)} center={false} occlude={false} distanceFactor={42}>
        <div className="reveal-tag sm">
          <div className="t" style={{ color: '#ff6b74' }}>
            Ratawi concession
          </div>
        </div>
      </Html>
    </>
  );
}
