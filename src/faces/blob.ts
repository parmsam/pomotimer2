import { animate } from 'animejs';
import { reducedMotion } from '../fx/anims';
import { clamp01, setLevel } from './common';
import type { Face, FaceContext } from './types';

const BLOB = 'M110 44C146 44 170 76 172 112C174 146 150 160 110 160C70 160 46 146 48 112C50 76 74 44 110 44Z';

// Class is "blobpet": ".blob" is taken by the background color blobs.
/** A squishy slime that jiggles while you work, fills up as you go, and melts on breaks. */
export function blobFace(): Face {
  let root: SVGSVGElement | null = null;

  const fill = (p: number, ctx: FaceContext) => (ctx.mode === 'focus' ? 1 - clamp01(p) : clamp01(p));

  function draw(p: number, ctx: FaceContext) {
    if (!root) return;
    const f = fill(p, ctx);
    root.querySelector('.bl-fill')!.setAttribute('y', String(160 - 116 * f));
    root.setAttribute('data-state', ctx.mode !== 'focus' ? 'relaxed' : ctx.status === 'running' ? 'working' : 'idle');
    setLevel(root, f);
  }

  return {
    id: 'blob',
    label: 'Blob Pet',
    preview: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 8c9 0 15 8 15 17 0 9-6 13-15 13S9 34 9 25C9 16 15 8 24 8Z" fill="var(--mode)"/><circle cx="19" cy="23" r="2.4" fill="#1d2230"/><circle cx="29" cy="23" r="2.4" fill="#1d2230"/><path d="M21 29q3 2 6 0" stroke="#1d2230" stroke-width="1.6" fill="none" stroke-linecap="round"/><ellipse cx="24" cy="41" rx="12" ry="2" fill="currentColor" opacity=".15"/></svg>`,
    mount(layer, ctx) {
      layer.insertAdjacentHTML(
        'beforeend',
        `<svg class="blobpet" viewBox="0 0 220 220" aria-hidden="true">
          <defs><clipPath id="bl-clip"><path d="${BLOB}"/></clipPath></defs>
          <ellipse class="bl-shadow" cx="110" cy="164" rx="64" ry="7"/>
          <g class="bl-jiggle">
            <path class="bl-body" d="${BLOB}"/>
            <rect class="bl-fill" x="40" width="140" height="130" clip-path="url(#bl-clip)"/>
            <ellipse class="bl-shine" cx="84" cy="70" rx="12" ry="7" transform="rotate(-30 84 70)"/>
            <g class="bl-face">
              <g class="bl-eyes"><ellipse cx="94" cy="104" rx="6" ry="8"/><ellipse cx="126" cy="104" rx="6" ry="8"/></g>
              <circle class="bl-glint" cx="96" cy="101" r="2"/><circle class="bl-glint" cx="128" cy="101" r="2"/>
              <path class="bl-closed" d="M88 106q6 4 12 0M120 106q6 4 12 0"/>
              <path class="bl-mouth" d="M103 122q7 6 14 0"/>
              <ellipse class="bl-cheek" cx="80" cy="118" rx="7" ry="4"/><ellipse class="bl-cheek" cx="140" cy="118" rx="7" ry="4"/>
            </g>
          </g>
        </svg>`,
      );
      root = layer.querySelector('svg.blobpet');
      draw(ctx.remainingMs / ctx.durationMs, ctx);
    },
    setProgress(p, ctx) {
      draw(p, ctx);
    },
    event(e, ctx) {
      if (!root) return;
      draw(ctx.remainingMs / ctx.durationMs, ctx);
      if (reducedMotion()) return;
      if (e === 'complete') animate(root.querySelector('.bl-jiggle')!, { y: [0, -26, 0], scaleY: [1, 1.12, 0.86, 1], duration: 900, ease: 'out(2)' });
    },
    unmount() {
      root?.remove();
      root = null;
    },
  };
}
