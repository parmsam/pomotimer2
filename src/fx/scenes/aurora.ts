import { Mesh, OrthographicCamera, PlaneGeometry, Scene as ThreeScene, ShaderMaterial, Vector2 } from 'three';
import { color, createRenderer } from './common';
import type { SceneFactory } from './types';

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// Slow flowing bands of the theme colors over the background (fbm value noise).
const fragmentShader = /* glsl */ `
  precision mediump float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uPulse;
  uniform vec2 uRes;
  uniform vec3 uBg, uA, uB, uC;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.02; a *= 0.5; }
    return v;
  }

  void main() {
    vec2 uv = vUv;
    uv.x *= uRes.x / uRes.y;
    float t = uTime * 0.05;
    float n1 = fbm(uv * 1.4 + vec2(t, -t * 0.6));
    float n2 = fbm(uv * 2.2 - vec2(t * 0.7, t * 0.3) + n1);
    // Curtains: bright where the warped noise forms ridges, stronger toward the top.
    float band = smoothstep(0.35, 0.75, n2) * (0.35 + 0.65 * vUv.y);
    vec3 tint = mix(uA, uB, smoothstep(0.2, 0.8, n1));
    tint = mix(tint, uC, smoothstep(0.55, 0.9, n2) * 0.6);
    float glow = band * (0.55 + 0.45 * uPulse);
    gl_FragColor = vec4(mix(uBg, tint, glow * 0.75), 1.0);
  }
`;

export const createAurora: SceneFactory = (canvas, colors) => {
  const renderer = createRenderer(canvas);
  const scene = new ThreeScene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const uniforms = {
    uTime: { value: 0 },
    uPulse: { value: 0 },
    uRes: { value: new Vector2(1, 1) },
    uBg: { value: color(colors.bg) },
    uA: { value: color(colors.a) },
    uB: { value: color(colors.b) },
    uC: { value: color(colors.c) },
  };
  const material = new ShaderMaterial({ vertexShader, fragmentShader, uniforms, depthTest: false });
  const mesh = new Mesh(new PlaneGeometry(2, 2), material);
  scene.add(mesh);

  return {
    resize(w, h) {
      renderer.setSize(w, h, false);
      uniforms.uRes.value.set(w, h);
    },
    setColors(c) {
      uniforms.uBg.value = color(c.bg);
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
      mesh.geometry.dispose();
      material.dispose();
      renderer.dispose();
    },
  };
};
