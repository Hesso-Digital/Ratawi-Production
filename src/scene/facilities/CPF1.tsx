/**
 * CPF-1, central processing facility: simplified from design-3d/src/scene.js
 * `buildCPF` (tank farm, separators, process modules, columns, heater stacks,
 * a control building and a flare). Always lit; the oil glow around it responds
 * to flow progress elsewhere (FlowLines.tsx).
 */
import { CPF_WORLD, heightAt } from '../world';
import { FACILITY_MATERIALS as M } from './materials';
import { Flare } from './Flare';

function Tank({ x, z, r = 1.05, h = 1.25 }: { x: number; z: number; r?: number; h?: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, h / 2, 0]} material={M.white} castShadow receiveShadow>
        <cylinderGeometry args={[r, r, h, 32]} />
      </mesh>
      <mesh position={[0, h, 0]} material={M.white} castShadow>
        <sphereGeometry args={[r, 32, 10, 0, Math.PI * 2, 0, Math.PI * 0.18]} />
      </mesh>
      <mesh material={M.warmLight} position={[r * 1.02, h + 0.02, 0]}>
        <sphereGeometry args={[0.035, 8, 6]} />
      </mesh>
    </group>
  );
}

function ProcessModule({ x, z, w, h, d }: { x: number; z: number; w: number; h: number; d: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, h / 2, 0]} material={M.building} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
      </mesh>
      <mesh position={[0, h + 0.03, 0]} material={M.roofBlue}>
        <boxGeometry args={[w * 1.02, 0.06, d * 1.02]} />
      </mesh>
      {[-0.3, 0, 0.3].map((f, i) => (
        <mesh key={i} position={[f * w, h * 0.62, d / 2 + 0.01]} material={M.warmLight}>
          <boxGeometry args={[w * 0.18, h * 0.22, 0.01]} />
        </mesh>
      ))}
    </group>
  );
}

function Column({ x, z, r, h }: { x: number; z: number; r: number; h: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, h / 2, 0]} material={M.steel} castShadow>
        <cylinderGeometry args={[r, r, h, 16]} />
      </mesh>
      <mesh position={[0, h + 0.05, 0]} material={M.redLight}>
        <sphereGeometry args={[0.05, 8, 6]} />
      </mesh>
    </group>
  );
}

export function CPF1() {
  const [cx, cz] = CPF_WORLD;
  const y = heightAt(cx, cz) + 0.02;

  return (
    <group position={[cx, y, cz]}>
      <mesh position={[0, 0.08, 0]} material={M.concrete} receiveShadow>
        <boxGeometry args={[14, 0.15, 11]} />
      </mesh>
      <Tank x={-5.3} z={-3.6} />
      <Tank x={-2.8} z={-3.6} />
      <Tank x={-5.3} z={-1.1} />
      <Tank x={-2.8} z={-1.1} />
      {[1.6, 2.6, 3.6].map((z, i) => (
        <group key={i} position={[-3.6, 0.65, z]} rotation={[0, 0, Math.PI / 2]}>
          <mesh material={M.steel} castShadow>
            <cylinderGeometry args={[0.32, 0.32, 2.6, 16]} />
          </mesh>
        </group>
      ))}
      <ProcessModule x={0.3} z={-3.5} w={1.6} h={0.9} d={1.2} />
      <ProcessModule x={2.2} z={-3.5} w={1.6} h={1.1} d={1.2} />
      <ProcessModule x={0.3} z={-1.6} w={1.6} h={0.8} d={1.2} />
      <ProcessModule x={2.2} z={-1.6} w={1.6} h={1.3} d={1.2} />
      <ProcessModule x={4.4} z={-2.6} w={1.8} h={1.6} d={2.6} />
      <Column x={0.8} z={1.6} r={0.26} h={3.4} />
      <Column x={1.8} z={1.9} r={0.2} h={2.6} />
      <Column x={2.6} z={1.3} r={0.3} h={4.2} />
      <mesh position={[4.6, 1.8, 1.2]} material={M.steelDark} castShadow>
        <cylinderGeometry args={[0.16, 0.16, 3.6, 10]} />
      </mesh>
      <mesh position={[5.1, 1.55, 1.6]} material={M.steelDark} castShadow>
        <cylinderGeometry args={[0.12, 0.12, 3.1, 10]} />
      </mesh>
      <mesh position={[4.5, 0.5, 4.1]} material={M.white} castShadow receiveShadow>
        <boxGeometry args={[2.4, 0.7, 1.4]} />
      </mesh>
      <mesh position={[1.8, 0.4, 4.3]} material={M.building} castShadow>
        <boxGeometry args={[1.6, 0.5, 1.0]} />
      </mesh>
      {[
        [-6.6, -5.2],
        [6.6, -5.2],
        [-6.6, 5.2],
        [6.6, 5.2],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 1.1, 0]} material={M.steelDark}>
            <cylinderGeometry args={[0.03, 0.03, 2.2, 6]} />
          </mesh>
          <mesh position={[0, 2.4, 0]} material={M.whiteLight}>
            <sphereGeometry args={[0.045, 8, 6]} />
          </mesh>
        </group>
      ))}
      <Flare position={[-6.4, 0, 4.6]} height={5.6} scale={1} getIntensity={() => 1} />
      <pointLight color="#ffd6a0" intensity={10} distance={16} decay={1.5} position={[0, 4, 0]} />
    </group>
  );
}
