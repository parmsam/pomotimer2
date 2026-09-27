import type { Scene, SceneColors, SceneFactory, SceneId } from './types';

export type { SceneId } from './types';

export const SCENES: { id: SceneId; label: string }[] = [
  { id: 'fireflies', label: 'Fireflies' },
  { id: 'aurora', label: 'Aurora' },
  { id: 'rain', label: 'Rain' },
];

// Each scene (and three.js with it) is only downloaded when chosen.
const loaders: Record<SceneId, () => Promise<SceneFactory>> = {
  fireflies: () => import('./fireflies').then((m) => m.createFireflies),
  aurora: () => import('./aurora').then((m) => m.createAurora),
  rain: () => import('./rain').then((m) => m.createRain),
};

export function readSceneColors(): SceneColors {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  return { bg: v('--bg'), a: v('--blob1'), b: v('--blob2'), c: v('--blob3'), text: v('--text') };
}

export interface SceneRunner {
  setColors(c: SceneColors): void;
  /** Breaks are calmer: motion slows smoothly. */
  setCalm(calm: boolean): void;
  /** A soft flash, e.g. when a session ends. */
  pulse(): void;
  stop(): void;
}

/**
 * Runs a scene on a canvas: render loop, pause while the tab is hidden, resize,
 * and smoothly eased speed. Returns null if WebGL isn't available.
 */
export async function runScene(id: SceneId, canvas: HTMLCanvasElement): Promise<SceneRunner | null> {
  let scene: Scene;
  try {
    scene = (await loaders[id]())(canvas, readSceneColors());
  } catch {
    return null; // no WebGL or failed to load: caller falls back to the CSS background
  }

  let raf = 0;
  let last = performance.now();
  let time = 0;
  let speed = 1;
  let targetSpeed = 1;
  let pulse = 0;
  let stopped = false;

  const resize = () => scene.resize(canvas.clientWidth, canvas.clientHeight);
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  function frame(now: number) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    speed += (targetSpeed - speed) * Math.min(1, dt * 1.5);
    time += dt * speed;
    pulse = Math.max(0, pulse - dt * 0.6);
    scene.render(time, dt * speed, pulse);
    raf = requestAnimationFrame(frame);
  }

  const onVisibility = () => {
    cancelAnimationFrame(raf);
    if (!document.hidden && !stopped) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  };
  document.addEventListener('visibilitychange', onVisibility);
  onVisibility();

  return {
    setColors: (c) => scene.setColors(c),
    setCalm: (calm) => (targetSpeed = calm ? 0.4 : 1),
    pulse: () => (pulse = 1),
    stop() {
      stopped = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      scene.dispose();
    },
  };
}
