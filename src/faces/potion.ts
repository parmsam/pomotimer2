import { animate } from 'animejs';
import { reducedMotion } from '../fx/anims';
import { clamp01, setLevel } from './common';
import type { Face, FaceContext } from './types';

const FLASK = 'M97 30V78A46 46 0 1 0 123 78V30Z';
const BOTTOM = 166; // lowest liquid line
const TOP = 70; // liquid reaches the neck when full
const SPARKLES: [number, number, number][] = [
  [56, 96, 1], [164, 110, 0.8], [62, 156, 0.7], [160, 164, 1], [150, 70, 0.6],
];
const STAR = 'M0 -6Q1 -1 6 0Q1 1 0 6Q-1 1 -6 0Q-1 -1 0 -6Z';

/** A flask that fills as a focus session "brews" and empties as you "drink" it on breaks. */
export function potionFace(): Face {
  let root: SVGSVGElement | null = null;

  const fill = (p: number, ctx: FaceContext) => (ctx.mode === 'focus' ? 1 - clamp01(p) : clamp01(p));

  function draw(level: number) {
    if (!root) return;
    const y = BOTTOM - (BOTTOM - TOP) * level;
    root.querySelector('.po-liquid')!.setAttribute('transform', `translate(0 ${y})`);
    // The brew glows (and sparkles) more strongly the fuller it gets.
    root.querySelector<SVGElement>('.po-aura')!.style.opacity = String(0.15 + 0.6 * level);
    root.querySelector<SVGElement>('.po-sparkles')!.style.opacity = String(level);
    setLevel(root, level);
  }

  return {
    id: 'potion',
    label: 'Potion',
    preview: `<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="19" y="4" width="10" height="5" rx="1.5" fill="#b08a5a"/><path d="M20 9v8a12 12 0 1 0 8 0V9Z" fill="none" stroke="currentColor" stroke-opacity=".5" stroke-width="2"/><path d="M13 30h22a11 11 0 0 1-22 0Z" fill="var(--mode)"/><circle cx="21" cy="34" r="1.6" fill="#fff" opacity=".7"/><circle cx="27" cy="37" r="1.2" fill="#fff" opacity=".7"/></svg>`,
    mount(layer, ctx) {
      const bubbles = [0, 1, 2, 3, 4]
        .map((i) => `<circle class="po-bubble" cx="${92 + i * 9}" cy="20" r="${2 + (i % 3)}" style="animation-delay:${i * 0.55}s"/>`)
        .join('');
      const sparkles = SPARKLES.map(
        ([x, y, k], i) => `<g transform="translate(${x} ${y}) scale(${k})"><path class="po-sparkle" d="${STAR}" style="animation-delay:${i * 0.7}s"/></g>`,
      ).join('');
      layer.insertAdjacentHTML(
        'beforeend',
        `<svg class="potion" viewBox="0 0 220 220" aria-hidden="true">
          <defs>
            <clipPath id="po-clip"><path d="${FLASK}"/></clipPath>
            <radialGradient id="po-glow"><stop offset="0%" class="po-glow-in"/><stop offset="100%" class="po-glow-out"/></radialGradient>
          </defs>
          <circle class="po-aura" cx="110" cy="122" r="80" fill="url(#po-glow)"/>
          <g class="po-sparkles">${sparkles}</g>
          <g class="po-body">
            <path class="po-glass" d="${FLASK}"/>
            <g clip-path="url(#po-clip)">
              <g class="po-liquid">
                <g class="po-wave"><path d="M20 0q10 -5 20 0t20 0t20 0t20 0t20 0t20 0t20 0t20 0t20 0v200H20Z"/></g>
                ${bubbles}
              </g>
            </g>
            <path class="po-outline" d="${FLASK}"/>
            <path class="po-shine" d="M78 112a34 34 0 0 1 12-22"/>
            <g class="po-cork-pop"><rect class="po-cork" x="92" y="16" width="36" height="16" rx="4"/></g>
            <g class="po-steam"><circle cx="104" cy="8" r="6"/><circle cx="116" cy="2" r="8"/><circle cx="110" cy="-8" r="5"/></g>
          </g>
        </svg>`,
      );
      root = layer.querySelector('svg.potion');
      root!.classList.toggle('running', ctx.status === 'running');
      draw(fill(ctx.remainingMs / ctx.durationMs, ctx));
    },
    setProgress(p, ctx) {
      root?.classList.toggle('running', ctx.status === 'running');
      draw(fill(p, ctx));
    },
    event(e, ctx) {
      if (!root) return;
      root.classList.toggle('running', ctx.status === 'running');
      if (reducedMotion()) return;
      if (e === 'complete') {
        const steam = root.querySelector('.po-steam')!;
        animate(steam, { opacity: [0, 0.8, 0], y: [0, -24], duration: 1800, ease: 'out(2)' });
        animate(root.querySelector('.po-body')!, { rotate: [0, -3, 3, 0], duration: 700, ease: 'inOutSine' });
        // Pop! The cork flies up with a spin and drops back into place.
        animate(root.querySelector('.po-cork-pop')!, {
          y: [0, -34, 0],
          rotate: [0, 200, 360],
          duration: 1000,
          ease: 'inOutQuad',
        });
      }
    },
    unmount() {
      root?.remove();
      root = null;
    },
  };
}
