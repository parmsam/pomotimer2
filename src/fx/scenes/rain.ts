import { BufferAttribute, BufferGeometry, LineBasicMaterial, LineSegments, OrthographicCamera, Scene as ThreeScene } from 'three';
import { color, createRenderer } from './common';
import type { SceneFactory } from './types';

const COUNT = 220;
const SLANT = 0.18;

export const createRain: SceneFactory = (canvas, colors) => {
  const renderer = createRenderer(canvas);
  const scene = new ThreeScene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // Each drop: x, y, length, speed.
  const drops = Array.from({ length: COUNT }, () => ({
    x: Math.random() * 2.4 - 1.2,
    y: Math.random() * 2 - 1,
    len: 0.03 + Math.random() * 0.07,
    speed: 0.9 + Math.random() * 1.1,
  }));
  const positions = new Float32Array(COUNT * 6);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  const material = new LineBasicMaterial({ color: color(colors.text), transparent: true, opacity: 0.18 });
  const lines = new LineSegments(geometry, material);
  lines.frustumCulled = false;
  scene.add(lines);

  return {
    resize(w, h) {
      renderer.setSize(w, h, false);
    },
    setColors(c) {
      material.color = color(c.text);
    },
    render(_time, dt, pulse) {
      for (let i = 0; i < COUNT; i++) {
        const d = drops[i];
        d.y -= d.speed * dt;
        d.x -= d.speed * dt * SLANT;
        if (d.y < -1.1) {
          d.y = 1.1 + Math.random() * 0.3;
          d.x = Math.random() * 2.4 - 1.2;
        }
        const o = i * 6;
        positions[o] = d.x;
        positions[o + 1] = d.y;
        positions[o + 3] = d.x + d.len * SLANT;
        positions[o + 4] = d.y + d.len;
      }
      geometry.attributes.position.needsUpdate = true;
      material.opacity = 0.18 + 0.2 * pulse;
      renderer.render(scene, camera);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    },
  };
};
