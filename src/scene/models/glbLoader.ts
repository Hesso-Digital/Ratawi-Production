/**
 * Generic GLB loader for the field models in public/models (see the README
 * there). A model is used only when its file is present at build time
 * (`virtual:field-models`), so the procedural geometry stays as the fallback
 * and updated GLBs drop in by file name with no code change.
 *
 * Decoders are self-hosted under public/decoders (the venue PC is offline):
 * Draco and KTX2 (Basis) when a file needs them, meshopt is bundled.
 * `?models=procedural` forces the procedural geometry everywhere.
 */
import { useGLTF } from '@react-three/drei';
import type { WebGLRenderer } from 'three';
import { Color, Mesh, MeshBasicMaterial, type Material, type MeshStandardMaterial, type Object3D } from 'three';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import files from 'virtual:field-models';

export type FieldModelName =
  | 'cpf1'
  | 'ag25'
  | 'wellhead'
  | 'wellhead_agup'
  | 'export_marker'
  | 'flare'
  | 'pipe_rack'
  | 'pipeline_segment'
  | 'terrain_tile';

const DRACO_PATH = '/decoders/draco/';
const BASIS_PATH = '/decoders/basis/';

let renderer: WebGLRenderer | null = null;
let ktx2: KTX2Loader | null = null;

/** Called once from the Canvas so KTX2 textures can pick a GPU format. */
export function registerRenderer(gl: WebGLRenderer) {
  renderer = gl;
}

// drei's extendLoader hook: attach KTX2 when a renderer is known.
function extendLoader(loader: unknown) {
  if (!renderer) return;
  if (!ktx2) ktx2 = new KTX2Loader().setTranscoderPath(BASIS_PATH).detectSupport(renderer);
  (loader as { setKTX2Loader?: (l: KTX2Loader) => void }).setKTX2Loader?.(ktx2);
}

function forcedProcedural(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('models') === 'procedural';
}

const AVAILABLE = new Set(files.map((f) => f.replace(/\.glb$/i, '').toLowerCase()));

export function hasFieldModel(name: FieldModelName): boolean {
  return !forcedProcedural() && AVAILABLE.has(name);
}

export function fieldModelUrl(name: FieldModelName): string {
  return `/models/${name}.glb`;
}

/** Suspends until the GLB is loaded. Only call when hasFieldModel(name) is true. */
export function useFieldGLTF(name: FieldModelName) {
  return useGLTF(fieldModelUrl(name), DRACO_PATH, true, extendLoader as never);
}

export function preloadFieldModels(names: FieldModelName[]) {
  for (const n of names) if (hasFieldModel(n)) useGLTF.preload(fieldModelUrl(n), DRACO_PATH, true, extendLoader as never);
}

/**
 * Bloom-friendly materials: every emissive material in the GLB becomes an
 * unlit `toneMapped: false` HDR colour (the scene's `hdr()` look), so it blooms
 * like the procedural lights. Lit PBR materials (and any textures in them) are
 * kept, only nudged to the scene's environment response.
 */
function isEmissive(m: MeshStandardMaterial): boolean {
  if (/^emit/i.test(m.name)) return true;
  const e = m.emissive;
  return !!e && (e.r + e.g + e.b) * (m.emissiveIntensity ?? 1) > 0.6;
}

export function toHoloMaterial(src: Material): Material {
  const m = src as MeshStandardMaterial;
  if (!('emissive' in m) || !isEmissive(m)) {
    if ('envMapIntensity' in m) m.envMapIntensity = 0.8;
    return m;
  }
  const strength = Math.max(1, m.emissiveIntensity ?? 1);
  const color = (m.emissive && m.emissive.getHex() !== 0 ? m.emissive.clone() : new Color(m.color)).multiplyScalar(
    Math.min(8, 1.6 * strength),
  );
  const out = new MeshBasicMaterial({
    name: m.name,
    color,
    map: m.emissiveMap ?? null,
    toneMapped: false,
    transparent: m.transparent,
    opacity: m.opacity,
    side: m.side,
    depthWrite: m.depthWrite,
  });
  out.userData.base = color.clone();
  return out;
}

/** Deep-clones a GLB scene with its own materials (so timeline animation stays per model) and the holo palette. */
export function cloneForScene(root: Object3D, opts: { shadows?: boolean } = {}): Object3D {
  const clone = root.clone(true);
  const cache = new Map<Material, Material>();
  clone.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const swap = (mat: Material) => {
      let out = cache.get(mat);
      if (!out) {
        out = toHoloMaterial(mat.clone());
        cache.set(mat, out);
      }
      return out;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material);
    const lit = !(mesh.material as Material & { isMeshBasicMaterial?: boolean }).isMeshBasicMaterial;
    mesh.castShadow = !!opts.shadows && lit;
    mesh.receiveShadow = !!opts.shadows && lit;
    // Inspect uses dedicated hit volumes (explore/InspectTargets.tsx); skip per-triangle raycasts here.
    mesh.raycast = () => {};
  });
  return clone;
}

/**
 * The unlit (emissive) materials under the named node, each given its own copy
 * so the timeline can drive that node alone (e.g. one inlet valve at a time).
 */
export function emissiveUnder(root: Object3D, nodeName: string): MeshBasicMaterial[] {
  const node = root.getObjectByName(nodeName);
  const out: MeshBasicMaterial[] = [];
  node?.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh || Array.isArray(mesh.material)) return;
    const m = mesh.material as MeshBasicMaterial;
    if (!m.isMeshBasicMaterial) return;
    const own = m.clone();
    own.userData.base = (m.userData.base as Color | undefined)?.clone() ?? m.color.clone();
    mesh.material = own;
    out.push(own);
  });
  return out;
}

/** The named node itself (for scale/visibility animation), if the model has it. */
export function nodeNamed(root: Object3D, nodeName: string): Object3D | undefined {
  return root.getObjectByName(nodeName) ?? undefined;
}
