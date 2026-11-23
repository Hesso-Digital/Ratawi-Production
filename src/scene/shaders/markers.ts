/**
 * Well marker materials (concepts 01/02/04): the teardrop pin and its glowing
 * ground ring. Both are instanced and take the per-well colour from
 * `instanceColor` (HDR at night so they bloom).
 *
 * Night: neon glass pin, bright rim and a hot core; ground ring with a soft
 * inner glow and a slow ripple. Day: the pin becomes a solid satin peg
 * (gold for AGUP, pearl for producing wells, `uDayColorA/B` picked by
 * `aAgup`) and the ring fades to a faint gold trace.
 */
import { AdditiveBlending, Color, DoubleSide, LatheGeometry, ShaderMaterial, Vector2 } from 'three';

/** Teardrop pin, tip at the origin, ~1 unit tall. */
export function createPinGeometry() {
  const r = 0.27;
  const cy = 0.72;
  const beta = Math.acos(r / cy);
  const pts: Vector2[] = [new Vector2(0.0001, 0)];
  const n = 18;
  for (let i = 0; i <= n; i++) {
    const g = beta + ((Math.PI - beta) * i) / n;
    pts.push(new Vector2(Math.max(0.0001, Math.sin(g) * r), cy - Math.cos(g) * r));
  }
  return new LatheGeometry(pts, 20);
}

export function createPinMaterial() {
  return new ShaderMaterial({
    toneMapped: false,
    uniforms: {
      uDay: { value: 0 },
      uGold: { value: new Color('#c9a03c') },
      uPearl: { value: new Color('#f3eee4') },
    },
    vertexShader: /* glsl */ `
      attribute float aAgup;
      varying vec3 vN; varying vec3 vV; varying vec3 vC; varying float vAgup; varying float vH;
      void main() {
        vC = instanceColor;
        vAgup = aAgup;
        vH = position.y;
        vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * mat3(instanceMatrix) * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uDay; uniform vec3 uGold; uniform vec3 uPearl;
      varying vec3 vN; varying vec3 vV; varying vec3 vC; varying float vAgup; varying float vH;
      void main() {
        vec3 n = normalize(vN);
        float facing = abs(dot(n, normalize(vV)));
        float rim = pow(1.0 - facing, 2.0);
        vec3 night = vC * (0.35 + 1.5 * rim) + vec3(1.0) * pow(facing, 8.0) * 0.5 * smoothstep(0.4, 0.75, vH);
        // Day: satin peg lit from the sun direction used by Lighting.tsx.
        vec3 base = mix(uPearl, uGold, vAgup);
        float lit = 0.55 + 0.45 * max(dot(n, normalize(vec3(-0.42, 0.78, 0.33))), 0.0) + 0.25 * rim;
        vec3 day = base * lit;
        gl_FragColor = vec4(mix(night, day, uDay), 1.0);
      }
    `,
  });
}

export function createGroundRingMaterial() {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    toneMapped: false,
    uniforms: { uTime: { value: 0 }, uDay: { value: 0 }, uRipple: { value: 1 } },
    vertexShader: /* glsl */ `
      varying vec2 vP; varying vec3 vC; varying float vSeed;
      void main() {
        vP = position.xy;
        vC = instanceColor;
        vSeed = fract(instanceMatrix[3].x * 0.137 + instanceMatrix[3].z * 0.311);
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uDay; uniform float uRipple;
      varying vec2 vP; varying vec3 vC; varying float vSeed;
      void main() {
        float r = length(vP);
        float ring = exp(-pow((r - 0.62) / 0.045, 2.0));
        float halo = exp(-r * r * 4.0) * 0.35;
        float rr = fract(uTime * 0.35 + vSeed) * 1.25;
        float ripple = exp(-pow((r - rr) / 0.05, 2.0)) * (1.0 - rr / 1.25) * 0.8 * uRipple;
        float a = (ring + halo + ripple) * smoothstep(1.3, 1.1, r) * (1.0 - 0.75 * uDay);
        gl_FragColor = vec4(vC * a, a);
      }
    `,
  });
}
