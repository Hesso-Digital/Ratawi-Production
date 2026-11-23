/**
 * GLSL shader materials lifted from the approved design-3d prototype
 * (design-3d/src/scene.js), consolidated into one module (the plan's
 * src/scene/shaders/{flowline,beam,boundary,sky}.ts split by file, kept here
 * as one file for a small scene). Each factory returns a fresh
 * THREE.ShaderMaterial instance; callers memoize them with useMemo.
 */
import { AdditiveBlending, Color, DoubleSide, ShaderMaterial, type ColorRepresentation, type Texture } from 'three';

export function hdr(color: ColorRepresentation, k: number) {
  return new Color(color).multiplyScalar(k);
}

/** A tube that lights up from one end as `uProgress` rises, used for every flowline. */
export function createFlowMaterial(color: Color, idle: Color, len: number) {
  return new ShaderMaterial({
    uniforms: {
      uColor: { value: color.clone() },
      uIdle: { value: idle.clone() },
      uProgress: { value: 1 },
      uTime: { value: 0 },
      uLen: { value: len },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform vec3 uIdle; uniform float uProgress; uniform float uTime; uniform float uLen;
      varying vec2 vUv;
      void main() {
        float x = vUv.x;
        float lit = step(x, uProgress);
        float pulse = 0.75 + 0.25 * sin((x * uLen * 2.2 - uTime * 7.0));
        float head = (uProgress < 0.999) ? exp(-abs(x - uProgress) * uLen * 1.2) * 4.0 : 0.0;
        vec3 c = mix(uIdle, uColor * pulse, lit) + uColor * head * step(x, uProgress + 0.02);
        gl_FragColor = vec4(c, 1.0);
      }
    `,
  });
}

/** A vertical cone of light fading toward its tip, used for the well beacons. */
export function createBeamMaterial(color: Color) {
  return new ShaderMaterial({
    uniforms: { uColor: { value: color.clone() }, uOpacity: { value: 1 } },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        float a = pow(1.0 - vUv.y, 2.2) * uOpacity;
        gl_FragColor = vec4(uColor * a, a);
      }
    `,
  });
}

/** GPU point sprites for flow dots and embers, sized by distance like the prototype. */
export function createPointsMaterial(glowTexture: Texture) {
  return new ShaderMaterial({
    uniforms: { uTex: { value: glowTexture }, uScale: { value: 1 } },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute vec3 aColor; attribute float aSize; varying vec3 vC; uniform float uScale;
      void main() {
        vC = aColor;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uScale * (60.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uTex; varying vec3 vC;
      void main() {
        vec4 t = texture2D(uTex, gl_PointCoord);
        if (t.a < 0.01) discard;
        gl_FragColor = vec4(vC * t.a, t.a);
      }
    `,
  });
}

/** Glowing boundary wall with a soft scanline, ground up from the concession tube. */
export function createBoundaryWallMaterial(color: Color) {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    uniforms: { uColor: { value: color.clone() }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vW;
      void main() {
        vUv = uv;
        vW = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uTime;
      varying vec2 vUv; varying vec3 vW;
      void main() {
        float a = pow(1.0 - vUv.y, 2.8) * 0.5;
        float scan = 0.12 * smoothstep(0.96, 1.0, sin((vUv.y * 6.0 - uTime * 0.8) * 3.1416));
        float lines = 0.08 * step(0.5, fract((vW.x + vW.z) * 1.2));
        a += scan * (1.0 - vUv.y) + lines * (1.0 - vUv.y) * 0.5;
        gl_FragColor = vec4(uColor * a, a);
      }
    `,
  });
}

/** Blue-hour sky dome, gaining a warm gold tint as `uGold` rises at the milestone. */
export function createSkyMaterial() {
  return new ShaderMaterial({
    side: DoubleSide,
    depthWrite: false,
    fog: false,
    uniforms: { uGold: { value: 0 }, uDay: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vP;
      void main() {
        vP = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vP; uniform float uGold; uniform float uDay;
      float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        float y = vP.y;
        vec3 zen = vec3(0.01, 0.018, 0.04);
        vec3 hor = vec3(0.06, 0.10, 0.17);
        vec3 c = mix(hor, zen, smoothstep(0.0, 0.45, y));
        float sun = max(0.0, dot(normalize(vec3(vP.x, 0.0, vP.z)), normalize(vec3(1.0, 0.0, -0.35))));
        c += vec3(0.55, 0.22, 0.08) * pow(sun, 6.0) * exp(-max(y, 0.0) * 14.0) * (0.55 + 0.6 * uGold);
        c += vec3(0.08, 0.12, 0.2) * exp(-abs(y) * 18.0);
        vec2 sp = floor(vP.xz / (max(y, 0.05)) * 260.0);
        float st = step(0.9975, h(sp)) * smoothstep(0.08, 0.4, y);
        c += vec3(st) * 0.9 * (1.0 - uDay);
        // Day: pale dusty-blue desert sky, bright haze band at the horizon, sun glow.
        vec3 dZen = vec3(0.28, 0.48, 0.74);
        vec3 dHor = vec3(0.80, 0.78, 0.72);
        vec3 d = mix(dHor, dZen, smoothstep(-0.02, 0.6, y));
        vec3 sd = normalize(vec3(-0.42, 0.78, 0.33));
        float sdot = max(0.0, dot(normalize(vP), sd));
        d += vec3(1.0, 0.92, 0.75) * (pow(sdot, 900.0) * 6.0 + pow(sdot, 12.0) * 0.25);
        c = mix(c, d, uDay);
        gl_FragColor = vec4(c, 1.0);
      }
    `,
  });
}

/** Expanding gold shockwave ring + halo, ground-projected at the milestone. */
export function createShockwaveMaterial(color: Color) {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { uColor: { value: color.clone() }, uR: { value: 0 }, uA: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vP;
      void main() {
        vP = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uR; uniform float uA;
      varying vec2 vP;
      void main() {
        float d = length(vP);
        float w = exp(-pow((d - uR) / 0.9, 2.0)) * smoothstep(60.0, 10.0, uR);
        float halo = exp(-d * d / 120.0) * 0.18;
        float a = (w + halo) * uA;
        gl_FragColor = vec4(uColor * a, a);
      }
    `,
  });
}
