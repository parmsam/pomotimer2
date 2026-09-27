import { AdditiveBlending, BufferAttribute, BufferGeometry, OrthographicCamera, Points, Scene as ThreeScene, ShaderMaterial } from 'three';
import { color, createRenderer } from './common';
import type { SceneFactory } from './types';

const COUNT = 140;

const vertexShader = /* glsl */ `
  attribute vec3 seed;          // x, y start (0..1) and a per-fly random
  uniform float uTime;
  uniform float uAspect;
  uniform float uPixelRatio;
  varying float vSeed;
  varying float vTwinkle;
  void main() {
    float s = seed.z;
    // Lazy wandering paths, wrapping around the screen.
    vec2 p = seed.xy + vec2(sin(uTime * (0.08 + s * 0.05) + s * 40.0), cos(uTime * (0.06 + s * 0.04) + s * 17.0)) * 0.08;
    p.y = fract(p.y + uTime * 0.004 * (0.5 + s));
    vec2 ndc = p * 2.0 - 1.0;
    ndc.x *= 1.0;
    gl_Position = vec4(ndc, 0.0, 1.0);
    float depth = 0.4 + s * 0.6;   // nearer flies are bigger
    vTwinkle = 0.55 + 0.45 * sin(uTime * (1.0 + s * 2.0) + s * 60.0);
    gl_PointSize = (16.0 + 30.0 * depth) * uPixelRatio;
    vSeed = s;
  }
`;

const fragmentShader = /* glsl */ `
  precision mediump float;
  uniform vec3 uA, uB, uC;
  uniform float uPulse;
  varying float vSeed;
  varying float vTwinkle;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    // Bright core with a soft halo.
    float halo = pow(smoothstep(0.5, 0.0, d), 3.0) * 0.55;
    float core = smoothstep(0.09, 0.0, d);
    vec3 c = vSeed < 0.33 ? uA : vSeed < 0.66 ? uB : uC;
    float a = (halo + core) * vTwinkle * (0.8 + 0.7 * uPulse);
    gl_FragColor = vec4(mix(c, vec3(1.0), core * 0.5) * a, a);
  }
`;

export const createFireflies: SceneFactory = (canvas, colors) => {
  const renderer = createRenderer(canvas);
  const scene = new ThreeScene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const seeds = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    seeds[i * 3] = Math.random();
    seeds[i * 3 + 1] = Math.random();
    seeds[i * 3 + 2] = Math.random();
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(COUNT * 3), 3));
  geometry.setAttribute('seed', new BufferAttribute(seeds, 3));

  const uniforms = {
    uTime: { value: 0 },
    uPulse: { value: 0 },
    uAspect: { value: 1 },
    uPixelRatio: { value: renderer.getPixelRatio() },
    uA: { value: color(colors.a) },
    uB: { value: color(colors.b) },
    uC: { value: color(colors.c) },
  };
  const material = new ShaderMaterial({ vertexShader, fragmentShader, uniforms, transparent: true, depthWrite: false, blending: AdditiveBlending });
  const points = new Points(geometry, material);
  points.frustumCulled = false; // positions are computed in the shader
  scene.add(points);

  return {
    resize(w, h) {
      renderer.setSize(w, h, false);
      uniforms.uAspect.value = w / h;
    },
    setColors(c) {
      uniforms.uA.value = color(c.a);
      uniforms.uB.value = color(c.b);
      uniforms.uC.value = color(c.c);
    },
    render(time, _dt, pulse) {
      uniforms.uTime.value = time;
      uniforms.uPulse.value = pulse;
      renderer.render(scene, camera);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    },
  };
};
