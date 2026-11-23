/**
 * Click-to-inspect on the hall screen. Each asset gets a light, invisible hit
 * volume (box, cylinder or tubes along its pipeline), so picking is cheap and
 * works the same for the procedural geometry and the GLB models. The hovered
 * asset glows cyan, the selected one gold: a holographic shell, edge outline
 * and a ground ring, matching the scene's palette.
 */
import { Edges } from '@react-three/drei';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, CatmullRomCurve3, DoubleSide, Mesh, MeshBasicMaterial, TubeGeometry, Vector3 } from 'three';
import { hdr } from '../shaders/materials';
import { ALL_ASSETS, assetById, type InspectAsset } from './assets';
import { exploreStore, useExploreState } from './exploreStore';

const HOVER = '#4dd0e1';
const SELECT = '#ffb300';

function tubeGeometries(asset: InspectAsset, radius?: number) {
  if (asset.hit.type !== 'tubes') return [];
  const r = radius ?? asset.hit.radius;
  return asset.hit.paths
    .filter((p) => p.length >= 2)
    .map((p) => {
      const curve = new CatmullRomCurve3(p.map(([x, y, z]) => new Vector3(x, y, z)), false, 'centripetal', 0.1);
      return new TubeGeometry(curve, Math.max(8, Math.ceil(curve.getLength())), r, 6, false);
    });
}

function HitVolume({ asset }: { asset: InspectAsset }) {
  const gl = useThree((s) => s.gl);
  const tubes = useMemo(() => tubeGeometries(asset), [asset]);

  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    exploreStore.hover(asset.id);
    gl.domElement.style.cursor = 'pointer';
  };
  const out = () => {
    if (exploreStore.get().hoveredId === asset.id) exploreStore.hover(null);
    gl.domElement.style.cursor = '';
  };
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 6) return; // that was an orbit drag, not a click
    exploreStore.inspect(asset.id);
  };
  const handlers = { onPointerOver: over, onPointerOut: out, onClick: click };

  const [x, y, z] = asset.center;
  if (asset.hit.type === 'box') {
    const [w, h, d] = asset.hit.size;
    return (
      <mesh position={[x, y + h / 2, z]} visible={false} userData={{ assetId: asset.id }} {...handlers}>
        <boxGeometry args={[w, h, d]} />
      </mesh>
    );
  }
  if (asset.hit.type === 'cylinder') {
    const { radius, height } = asset.hit;
    return (
      <mesh position={[x, y + height / 2, z]} visible={false} userData={{ assetId: asset.id }} {...handlers}>
        <cylinderGeometry args={[radius, radius, height, 10]} />
      </mesh>
    );
  }
  return (
    <group {...handlers}>
      {tubes.map((g, i) => (
        <mesh key={i} geometry={g} visible={false} userData={{ assetId: asset.id }} />
      ))}
    </group>
  );
}

function Highlight({ asset, color, strong }: { asset: InspectAsset; color: string; strong: boolean }) {
  const ring = useRef<Mesh>(null);
  const fill = useMemo(
    () =>
      new MeshBasicMaterial({
        color: hdr(color, strong ? 1.6 : 1.1),
        transparent: true,
        opacity: strong ? 0.14 : 0.09,
        blending: AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    [color, strong],
  );
  const ringMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: hdr(color, 2.4),
        transparent: true,
        opacity: 0.85,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
        toneMapped: false,
      }),
    [color],
  );
  const tubes = useMemo(() => tubeGeometries(asset, asset.hit.type === 'tubes' ? Math.min(0.35, asset.hit.radius * 0.5) : 0), [asset]);

  useFrame(({ clock }) => {
    const r = ring.current;
    if (!r) return;
    const t = clock.elapsedTime;
    const s = 1 + 0.06 * Math.sin(t * 3);
    r.scale.set(s, s, s);
    ringMat.opacity = 0.55 + 0.3 * Math.sin(t * 3);
  });

  const [x, y, z] = asset.center;
  const edgeColor = hdr(color, 3);
  const showRing = asset.hit.type !== 'tubes' || asset.radius < 8;
  const ringR = asset.hit.type === 'tubes' ? 2.2 : Math.max(1.2, asset.radius);

  return (
    <group>
      {asset.hit.type === 'box' ? (
        <mesh position={[x, y + asset.hit.size[1] / 2, z]} material={fill} raycast={() => null}>
          <boxGeometry args={asset.hit.size} />
          <Edges color={edgeColor} threshold={20} />
        </mesh>
      ) : null}
      {asset.hit.type === 'cylinder' ? (
        <mesh position={[x, y + asset.hit.height / 2, z]} material={fill} raycast={() => null}>
          <cylinderGeometry args={[asset.hit.radius, asset.hit.radius, asset.hit.height, 24, 1, true]} />
          <Edges color={edgeColor} threshold={20} />
        </mesh>
      ) : null}
      {tubes.map((g, i) => (
        <mesh key={i} geometry={g} material={ringMat} raycast={() => null} />
      ))}
      {showRing ? (
        <mesh ref={ring} position={[x, y + 0.15, z]} rotation={[-Math.PI / 2, 0, 0]} material={ringMat} raycast={() => null}>
          <ringGeometry args={[ringR, ringR + (strong ? 0.28 : 0.18), 64]} />
        </mesh>
      ) : null}
    </group>
  );
}

export function InspectTargets() {
  const { hoveredId, selectedId } = useExploreState();
  const gl = useThree((s) => s.gl);
  useEffect(() => () => void (gl.domElement.style.cursor = ''), [gl]);

  const hovered = hoveredId !== selectedId ? assetById(hoveredId) : undefined;
  const selected = assetById(selectedId);

  return (
    <group name="inspect-targets">
      {ALL_ASSETS.map((a) => (
        <HitVolume key={a.id} asset={a} />
      ))}
      {hovered ? <Highlight asset={hovered} color={HOVER} strong={false} /> : null}
      {selected ? <Highlight asset={selected} color={SELECT} strong /> : null}
    </group>
  );
}
