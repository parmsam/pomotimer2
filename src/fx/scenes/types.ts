export type SceneId = 'fireflies' | 'aurora' | 'rain';

export interface SceneColors {
  bg: string;
  a: string;
  b: string;
  c: string;
  text: string;
}

/** A background scene. Created by a lazily imported module that owns three.js. */
export interface Scene {
  resize(width: number, height: number): void;
  setColors(colors: SceneColors): void;
  /** `time` advances slower while calm, so motion eases rather than jumps. */
  render(time: number, dt: number, pulse: number): void;
  dispose(): void;
}

export type SceneFactory = (canvas: HTMLCanvasElement, colors: SceneColors) => Scene;
