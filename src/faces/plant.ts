import { animate } from 'animejs';
import { reducedMotion } from '../fx/anims';
import { clamp01, setLevel } from './common';
import type { Face, FaceContext } from './types';

const BASE = 118; // where the stem leaves the soil
const MAX_STEM = 84;
// Leaves: [share of stem height, side, reveal threshold]
const LEAVES: [number, 1 | -1, number][] = [
  [0.22, -1, 0.08],
  [0.4, 1, 0.28],
  [0.58, -1, 0.48],
  [0.74, 1, 0.66],
];

/** A little potted buddy whose plant grows through a focus session and blooms at the end. */
export function plantFace(): Face {
  let root: SVGSVGElement | null = null;

  // Grows during focus; stays fully grown (in bloom) on breaks.
  const growth = (p: number, ctx: FaceContext) => (ctx.mode === 'focus' ? 1 - clamp01(p) : 1);

  function draw(g: number) {
    if (!root) return;
    const len = 12 + MAX_STEM * g;
    const top = BASE - len;
    root.querySelector('.pl-stem')!.setAttribute('d', `M110 ${BASE}Q${104 + g * 2} ${BASE - len / 2} 110 ${top}`);
    root.querySelectorAll<SVGPathElement>('.pl-leaf').forEach((leaf, i) => {
      const [at, side, from] = LEAVES[i];
      const s = clamp01((g - from) / 0.14);
      leaf.setAttribute('transform', `translate(110 ${BASE - len * at}) scale(${side * s} ${s}) rotate(-28)`);
    });
    const bloom = clamp01((g - 0.9) / 0.1);
    root.querySelector('.pl-flower')!.setAttribute('transform', `translate(110 ${top}) scale(${bloom})`);
    root.querySelector('.pl-bud')!.setAttribute('transform', `translate(110 ${top}) scale(${1 - bloom})`);
    setLevel(root, g);
  }

  return {
    id: 'plant',
    label: 'Plant Buddy',
    preview: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 30V13" stroke="#5fae6e" stroke-width="2.5"/><path d="M24 22c-5-1-8-4-8-7 4 0 7 2 8 7ZM24 17c5-1 8-4 8-7-4 0-7 2-8 7Z" fill="#6bbf7a"/><circle cx="24" cy="11" r="3.5" fill="var(--mode)"/><path d="M14 29h20l-2 13H16Z" fill="var(--mode)"/><circle cx="21" cy="34" r="1" fill="var(--on-accent)"/><circle cx="27" cy="34" r="1" fill="var(--on-accent)"/></svg>`,
    mount(layer, ctx) {
      const petals = [0, 72, 144, 216, 288].map((a) => `<ellipse class="pl-petal" cx="0" cy="-9" rx="5.5" ry="9" transform="rotate(${a})"/>`).join('');
      layer.insertAdjacentHTML(
        'beforeend',
        `<svg class="plant" viewBox="0 0 220 220" aria-hidden="true">
          <g class="pl-sway">
            <path class="pl-stem"/>
            ${LEAVES.map(() => '<path class="pl-leaf" d="M0 0Q12 -10 26 0Q12 10 0 0Z"/>').join('')}
            <g class="pl-bud"><circle r="5"/></g>
            <g class="pl-flower">${petals}<circle class="pl-center" r="5"/></g>
          </g>
          <g class="pl-pot">
            <path class="pl-pot-body" d="M78 124H142L134 168H86Z"/>
            <rect class="pl-rim" x="72" y="114" width="76" height="14" rx="5"/>
            <ellipse class="pl-soil" cx="110" cy="116" rx="32" ry="3"/>
            <g class="pl-face">
              <circle class="pl-eye" cx="100" cy="142" r="3"/><circle class="pl-eye" cx="120" cy="142" r="3"/>
              <path class="pl-smile" d="M104 151Q110 156 116 151"/>
              <ellipse class="pl-cheek" cx="94" cy="149" rx="4" ry="2.4"/><ellipse class="pl-cheek" cx="126" cy="149" rx="4" ry="2.4"/>
            </g>
          </g>
        </svg>`,
      );
      root = layer.querySelector('svg.plant');
      draw(growth(ctx.remainingMs / ctx.durationMs, ctx));
    },
    setProgress(p, ctx) {
      draw(growth(p, ctx));
    },
    event(e, ctx) {
      if (!root) return;
      if (e === 'mode') draw(growth(ctx.remainingMs / ctx.durationMs, ctx));
      if (reducedMotion()) return;
      if (e === 'complete') animate(root.querySelector('.pl-pot')!, { y: [0, -10, 0], duration: 550, ease: 'out(3)' });
      if (e === 'start') animate(root.querySelector('.pl-sway')!, { rotate: [0, 3, -2, 0], duration: 900, ease: 'inOutSine' });
    },
    unmount() {
      root?.remove();
      root = null;
    },
  };
}
