import { animate } from 'animejs';
import { reducedMotion } from '../fx/anims';
import { clamp01, setLevel } from './common';
import type { Face } from './types';

// Bulbs meet at a neck around y=91; glass spans y=24..156.
const GLASS =
  'M72 24C72 60 104 76 106 88V94C104 106 72 122 72 156H148C148 122 116 106 114 94V88C116 76 148 60 148 24Z';
const TOP_BULB = 'M72 24C72 60 104 76 106 88V92H114V88C116 76 148 60 148 24Z';
const BOTTOM_BULB = 'M106 92V94C104 106 72 122 72 156H148C148 122 116 106 114 94V92Z';

/** Sand drains from the top bulb into a mound below; flips over when a session starts. */
export function hourglassFace(): Face {
  let root: SVGSVGElement | null = null;

  function draw(p: number) {
    if (!root) return;
    const left = clamp01(p);
    // Sand volume in a cone grows with height², so height follows sqrt(volume).
    const topH = 58 * Math.sqrt(left);
    const surface = 92 - topH;
    // Once sand is draining, its surface sinks into a funnel over the neck.
    const dip = left < 1 ? Math.min(7, topH) : 0;
    root
      .querySelector('.hg-top-sand')!
      .setAttribute('d', `M60 ${surface}H90Q110 ${surface + dip * 2} 130 ${surface}H160V92H60Z`);
    const h = 46 * Math.sqrt(1 - left);
    root
      .querySelector('.hg-bottom-sand')!
      .setAttribute('d', `M70 158H150V${158 - h * 0.35}Q110 ${158 - h * 1.25} 70 ${158 - h * 0.35}Z`);
    // The stream lands on the mound's peak (the curve's midpoint), where grains splash.
    const peak = 158 - h * 0.8;
    root.querySelectorAll('.hg-stream, .hg-grains').forEach((l) => l.setAttribute('y2', String(peak)));
    root.querySelector('.hg-splash')!.setAttribute('transform', `translate(0 ${peak})`);
    setLevel(root, 1 - left);
  }

  return {
    id: 'hourglass',
    label: 'Hourglass',
    preview: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M13 6h22M13 42h22" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M16 7c0 9 7 12 7 16v2c0 4-7 7-7 16h16c0-9-7-12-7-16v-2c0-4 7-7 7-16Z" fill="none" stroke="currentColor" stroke-opacity=".5" stroke-width="2"/><path d="M19 13h10c-1 4-4 6-5 8-1-2-4-4-5-8ZM18 40c1-4 3-6 6-7 3 1 5 3 6 7Z" fill="var(--mode)"/></svg>`,
    mount(layer, ctx) {
      layer.insertAdjacentHTML(
        'beforeend',
        `<svg class="hourglass" viewBox="0 0 220 220" aria-hidden="true">
          <defs>
            <clipPath id="hg-top"><path d="${TOP_BULB}"/></clipPath>
            <clipPath id="hg-bottom"><path d="${BOTTOM_BULB}"/></clipPath>
          </defs>
          <g class="hg-flip">
            <path class="hg-glass" d="${GLASS}"/>
            <path class="hg-top-sand" clip-path="url(#hg-top)"/>
            <path class="hg-bottom-sand" clip-path="url(#hg-bottom)"/>
            <line class="hg-stream" x1="110" y1="90" x2="110" y2="150"/>
            <line class="hg-grains" x1="110" y1="90" x2="110" y2="150"/>
            <g class="hg-splash"><circle cx="110" cy="-1" r="1.4"/><circle cx="110" cy="-1" r="1.2"/><circle cx="110" cy="-1" r="1"/></g>
            <path class="hg-shine" d="M80 32C80 52 94 66 100 74"/>
            <rect class="hg-plate" x="56" y="12" width="108" height="10" rx="4"/>
            <rect class="hg-plate" x="56" y="158" width="108" height="10" rx="4"/>
            <rect class="hg-post" x="60" y="22" width="5" height="136" rx="2"/>
            <rect class="hg-post" x="155" y="22" width="5" height="136" rx="2"/>
          </g>
        </svg>`,
      );
      root = layer.querySelector('svg.hourglass');
      root!.classList.toggle('running', ctx.status === 'running');
      draw(ctx.remainingMs / ctx.durationMs);
    },
    setProgress(p, ctx) {
      root?.classList.toggle('running', ctx.status === 'running' && p > 0);
      draw(p);
    },
    event(e, ctx) {
      if (!root) return;
      root.classList.toggle('running', ctx.status === 'running');
      if (reducedMotion()) return;
      const g = root.querySelector('.hg-flip')!;
      if (e === 'start' && ctx.remainingMs >= ctx.durationMs - 1500) {
        animate(g, { rotate: [180, 360], duration: 900, ease: 'inOut(3)' }); // flip it over to begin
      } else if (e === 'complete') {
        animate(g, { rotate: [0, -4, 4, 0], duration: 600, ease: 'inOutSine' });
      }
    },
    unmount() {
      root?.remove();
      root = null;
    },
  };
}
