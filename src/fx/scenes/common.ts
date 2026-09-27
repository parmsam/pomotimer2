import { Color, WebGLRenderer } from 'three';

export function createRenderer(canvas: HTMLCanvasElement): WebGLRenderer {
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'low-power' });
  // Backgrounds are soft; full retina resolution isn't worth the battery.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setClearColor(0x000000, 0);
  return renderer;
}

export const color = (css: string) => new Color().setStyle(css.trim() || '#000', 'srgb');
