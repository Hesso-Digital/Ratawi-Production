/**
 * Small canvas-based textures, generated once (useMemo) and reused by every
 * material that needs them. Simplified from design-3d/src/scene.js: that
 * prototype bakes a 4096² canvas with hand-drawn tracks/pads/highway at load,
 * which the plan explicitly flags as "takes seconds and isn't acceptable at
 * the venue" (section 8). This keeps the same sand-noise look at 1024² (one
 * CPU pass, a few ms, cached for the session) and leaves the fine track/pad
 * detail to the terrain contour shader + the flowline tubes instead.
 */
import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from 'three';

function mulberry32(seed: number) {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function valueNoise2D(seed: number) {
  const r = mulberry32(seed);
  const grid = new Float32Array(256 * 256);
  for (let i = 0; i < grid.length; i++) grid[i] = r();
  const at = (x: number, y: number) => grid[((y & 255) << 8) | (x & 255)];
  return (x: number, y: number) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const a = at(x0, y0);
    const b = at(x0 + 1, y0);
    const c = at(x0, y0 + 1);
    const d = at(x0 + 1, y0 + 1);
    const top = a + (b - a) * fx;
    const bottom = c + (d - c) * fx;
    return top + (bottom - top) * fy;
  };
}

export function createTerrainColorTexture(): Texture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const n1 = valueNoise2D(11);
  const n2 = valueNoise2D(29);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const u = (i / size) * 24;
      const v = (j / size) * 24;
      const base = n1(u, v) * 0.6 + n2(u * 3.1, v * 3.1) * 0.2 + n1(u * 0.3 + 50, v * 0.3) * 0.2;
      const b = 0.72 + base * 0.4;
      const k = (j * size + i) * 4;
      img.data[k] = 152 * b;
      img.data[k + 1] = 121 * b;
      img.data[k + 2] = 92 * b;
      img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  return tex;
}

export function createGrainTexture(): Texture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const n = valueNoise2D(41);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const v = 128 + 80 * (n(i * 0.2, j * 0.2) - 0.5) + 40 * (n(i * 0.8 + 7, j * 0.8) - 0.5);
      const k = (j * size + i) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = v;
      img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.repeat.set(60, 60);
  return tex;
}

export function createGlowSprite(): Texture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.18, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.18)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new CanvasTexture(canvas);
}
