import { animate } from 'animejs';
import { reducedMotion } from '../fx/anims';
import { clamp01, setLevel } from './common';
import type { Face, FaceContext } from './types';

const R = 84;
const C = 2 * Math.PI * R;
const OPEN = 0.93; // an ensō is left slightly open

/** A brush-drawn Zen circle that is painted as the session goes by, sealed when done. */
export function ensoFace(): Face {
  let root: SVGSVGElement | null = null;

  const drawn = (p: number, ctx: FaceContext) => (ctx.mode === 'focus' ? 1 - clamp01(p) : clamp01(p));

  function draw(d: number) {
    if (!root) return;
    const len = C * OPEN * d;
    root.querySelectorAll<SVGCircleElement>('.en-ink').forEach((c) => (c.style.strokeDasharray = `${len} ${C}`));
    setLevel(root, d);
  }

  return {
    id: 'enso',
    label: 'Zen Enso',
    preview: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M31 9A17 17 0 1 0 40 20" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><rect x="33" y="33" width="9" height="9" rx="1.5" fill="var(--mode)"/></svg>`,
    mount(layer, ctx) {
      layer.insertAdjacentHTML(
        'beforeend',
        `<svg class="enso" viewBox="0 0 220 220" aria-hidden="true">
          <defs>
            <filter id="en-brush" x="-10%" y="-10%" width="120%" height="120%">
              <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" result="n"/>
              <feDisplacementMap in="SourceGraphic" in2="n" scale="4"/>
            </filter>
          </defs>
          <circle class="en-ghost" cx="110" cy="110" r="${R}"/>
          <g transform="rotate(115 110 110)" filter="url(#en-brush)">
            <circle class="en-ink en-main" cx="110" cy="110" r="${R}"/>
            <circle class="en-ink en-dry" cx="110" cy="110" r="${R - 5}"/>
          </g>
          <g class="en-seal" transform="translate(160 164)">
            <rect x="-11" y="-11" width="22" height="22" rx="3"/>
            <rect class="en-seal-inner" x="-7" y="-7" width="14" height="14" rx="1.5"/>
          </g>
        </svg>`,
      );
      root = layer.querySelector('svg.enso');
      const seal = root!.querySelector<SVGGElement>('.en-seal')!;
      seal.style.opacity = ctx.mode === 'focus' ? '0' : '1';
      draw(drawn(ctx.remainingMs / ctx.durationMs, ctx));
    },
    setProgress(p, ctx) {
      draw(drawn(p, ctx));
    },
    event(e, ctx) {
      if (!root) return;
      const seal = root.querySelector<SVGGElement>('.en-seal')!;
      if (e === 'mode') seal.style.opacity = ctx.mode === 'focus' ? '0' : '1';
      if (e === 'complete') {
        seal.style.opacity = '1';
        if (!reducedMotion()) animate(seal, { scale: [1.8, 1], opacity: [0, 1], duration: 500, ease: 'out(4)' });
      }
    },
    unmount() {
      root?.remove();
      root = null;
    },
  };
}
