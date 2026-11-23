/**
 * Shared facility materials (module-level singletons, same pattern as
 * design-3d/src/scene.js's `M` palette), so CPF-1 and AG-25 reuse materials
 * instead of allocating new ones per mesh.
 */
import { MeshBasicMaterial, MeshStandardMaterial } from 'three';
import { hdr } from '../shaders/materials';

export const FACILITY_MATERIALS = {
  steel: new MeshStandardMaterial({ color: '#c3c8cf', metalness: 0.75, roughness: 0.32 }),
  steelDark: new MeshStandardMaterial({ color: '#6c727b', metalness: 0.7, roughness: 0.45 }),
  white: new MeshStandardMaterial({ color: '#dfe3e6', metalness: 0.2, roughness: 0.5 }),
  concrete: new MeshStandardMaterial({ color: '#8b8780', roughness: 0.9 }),
  building: new MeshStandardMaterial({ color: '#9aa1a8', metalness: 0.3, roughness: 0.6 }),
  roofBlue: new MeshStandardMaterial({ color: '#3d5b78', metalness: 0.4, roughness: 0.5 }),
  yellow: new MeshStandardMaterial({ color: '#c9a443', metalness: 0.4, roughness: 0.45 }),
  rack: new MeshStandardMaterial({ color: '#7b6d55', metalness: 0.5, roughness: 0.5 }),
  warmLight: new MeshBasicMaterial({ color: hdr('#ffc98a', 3), toneMapped: false }),
  whiteLight: new MeshBasicMaterial({ color: hdr('#e8f4ff', 2.4), toneMapped: false }),
  redLight: new MeshBasicMaterial({ color: hdr('#ff3030', 8), toneMapped: false }),
} as const;
