import type { Store } from '../core/store';
import type { AppData, Settings } from '../core/types';
import { reducedMotion } from '../fx/anims';
import { readSceneColors, runScene, type SceneRunner } from '../fx/scenes';

export type BackgroundId = Settings['background'];

/**
 * Switches the page background between the CSS blobs, a three.js scene, or nothing.
 * Scenes never run under reduced motion (the static gradient shows instead).
 */
export function createBackground(settings: Store<Settings>, data: Store<AppData>) {
  const bg = document.querySelector<HTMLElement>('.bg')!;
  let runner: SceneRunner | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let generation = 0;

  async function apply(id: BackgroundId) {
    const gen = ++generation;
    runner?.stop();
    runner = null;
    canvas?.remove();
    canvas = null;
    delete bg.dataset.sceneReady;

    const wantsScene = id !== 'blobs' && id !== 'none';
    bg.dataset.background = wantsScene && reducedMotion() ? 'none' : id;
    if (!wantsScene || reducedMotion()) return;

    const c = document.createElement('canvas');
    c.className = 'scene';
    bg.append(c);
    const r = await runScene(id, c);
    if (gen !== generation) return r?.stop(); // changed again while loading
    if (!r) {
      c.remove();
      bg.dataset.background = 'blobs'; // no WebGL: fall back quietly
      return;
    }
    canvas = c;
    runner = r;
    runner.setCalm(data.get().timer.mode !== 'focus');
    bg.dataset.sceneReady = 'true';
  }

  settings.subscribe((s, prev) => {
    if (s.background !== prev.background) void apply(s.background);
    // Theme colors transition over ~0.9s; read them once they've settled.
    if (s.theme !== prev.theme || s.modeColors !== prev.modeColors) setTimeout(() => runner?.setColors(readSceneColors()), 1000);
  });
  data.subscribe((d, prev) => {
    if (d.timer.mode !== prev.timer.mode) runner?.setCalm(d.timer.mode !== 'focus');
  });
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => void apply(settings.get().background));

  void apply(settings.get().background);

  return { pulse: () => runner?.pulse() };
}
