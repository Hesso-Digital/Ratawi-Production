/**
 * Projects a 3D world point onto the 1920x1080 stage, for HTML tags anchored
 * to scene objects (CPF-1, AG-25, AGUP wells, export line, SPP, concession).
 * Ported from design-3d/src/scene.js `RatawiScene.project`.
 */
import type { Camera, Vector3 } from 'three';
import { STAGE_HEIGHT, STAGE_WIDTH } from '../config';

export type StagePoint = { x: number; y: number; behind: boolean };

export function worldToStage(point: Vector3, camera: Camera): StagePoint {
  const p = point.clone().project(camera);
  return {
    x: (p.x * 0.5 + 0.5) * STAGE_WIDTH,
    y: (-p.y * 0.5 + 0.5) * STAGE_HEIGHT,
    behind: p.z > 1,
  };
}

export function isOnStage(p: StagePoint, margin = 20) {
  return !p.behind && p.x >= margin && p.x <= STAGE_WIDTH - margin && p.y >= margin && p.y <= STAGE_HEIGHT - margin;
}
