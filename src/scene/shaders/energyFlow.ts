/**
 * Energy flow shader for every flowline (concepts 01–03): a hot white-tinted
 * core inside a coloured glow, with scrolling value-noise "crackle" and
 * travelling pulses so the oil and gas read like current or fire moving
 * toward CPF-1 / AG-25 / export. All flowlines share one material and one
 * merged geometry; each vertex carries its group (for colour, progress and
 * focus dimming), its line length and a phase in `aFlow`.
 *
 *   aFlow.x  group index (see FLOW_GROUPS in FlowLines.tsx)
 *   aFlow.y  line length in world units (uv.x * len = distance from the source)
 *   aFlow.z  random phase
 *   aFlow.w  0 = main core, 1 = braid strand, 2 = outer glow shell
 */
import { AdditiveBlending, Color, ShaderMaterial, Vector3 } from 'three';

export const FLOW_GROUP_COUNT = 8;

export function createEnergyFlowMaterial(opts: { crackle: boolean }) {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
    defines: { GROUPS: FLOW_GROUP_COUNT, CRACKLE: opts.crackle ? 1 : 0 },
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: Array.from({ length: FLOW_GROUP_COUNT }, () => new Vector3(0, 0.8, 1)) },
      uProgress: { value: new Array(FLOW_GROUP_COUNT).fill(1) },
      uGain: { value: new Array(FLOW_GROUP_COUNT).fill(1) },
      uSpeed: { value: new Array(FLOW_GROUP_COUNT).fill(4) },
      uOpacity: { value: 1 },
    },
    vertexShader: /* glsl */ `
      attribute vec4 aFlow;
      varying vec2 vUv;
      varying vec4 vFlow;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vUv = uv;
        vFlow = aFlow;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uColor[GROUPS];
      uniform float uProgress[GROUPS];
      uniform float uGain[GROUPS];
      uniform float uSpeed[GROUPS];
      uniform float uOpacity;
      varying vec2 vUv;
      varying vec4 vFlow;
      varying vec3 vN;
      varying vec3 vV;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }

      void main() {
        int g = int(vFlow.x + 0.5);
        float len = vFlow.y;
        float phase = vFlow.z;
        float kind = vFlow.w;
        float progress = uProgress[g];
        float x = vUv.x;
        if (x > progress + 0.002) discard;
        float s = x * len;
        float t = uTime * uSpeed[g];
        float facing = abs(dot(normalize(vN), normalize(vV)));

        // Travelling pulses: bright packets heading downstream.
        float pulse = pow(0.5 + 0.5 * sin(s * 0.85 - t * 0.9 + phase * 6.2831), 10.0);
        float energy = 0.55 + 1.6 * pulse;
      #if CRACKLE
        // Two octaves of value noise scrolled downstream, sharpened into filaments.
        float n = noise(vec2(s * 1.7 - t * 1.3, vUv.y * 7.0 + phase * 13.0)) * 0.62
                + noise(vec2(s * 5.3 - t * 2.9, vUv.y * 3.0 - phase * 7.0)) * 0.38;
        float crackle = pow(smoothstep(0.35, 1.0, n), 2.2) * 2.6;
        energy += crackle;
      #endif
        // Leading edge of a line that is still filling (AGUP / gas start-up).
        float head = progress < 0.999 ? exp(-abs(x - progress) * len * 0.9) * 3.0 : 0.0;
        vec3 col = uColor[g] * uGain[g];
        float a;
        vec3 c;
        if (kind > 1.5) {
          // Outer glow shell: soft, brightest where the tube faces the camera.
          a = pow(facing, 2.2) * 0.28 * (0.6 + 0.4 * energy);
          c = col * a;
        } else {
          float core = pow(facing, kind > 0.5 ? 1.5 : 3.0);
          float k = (kind > 0.5 ? 0.6 : 1.0) * (energy + head);
          c = col * k * (0.45 + 0.9 * core) + vec3(1.0, 0.95, 0.85) * core * pulse * 0.6 * uGain[g];
          a = 1.0;
        }
        // Fade both ends in so lines melt into the wellhead / plant.
        float ends = smoothstep(0.0, 0.6, s) * smoothstep(0.0, 0.8, len - s);
        gl_FragColor = vec4(c * uOpacity * ends, a * uOpacity * ends);
      }
    `,
  });
}

export function hdrVec(color: Color, k: number, out: Vector3) {
  return out.set(color.r * k, color.g * k, color.b * k);
}
