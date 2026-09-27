import { animate } from 'animejs';
import { reducedMotion } from '../fx/anims';
import { clamp01, loadFont, setLevel } from './common';
import type { Face, FaceContext } from './types';

const BLOCKS = 10;
const LABELS = { focus: 'FOCUS', short: 'BREAK', long: 'LONG BREAK' } as const;

/** A retro green-screen handheld console: pixel clock and a block progress bar. */
export function handheldFace(): Face {
  let root: SVGSVGElement | null = null;

  function draw(p: number, ctx: FaceContext) {
    if (!root) return;
    const lit = Math.ceil(clamp01(p) * BLOCKS);
    root.querySelectorAll('.hh-block').forEach((b, i) => b.classList.toggle('on', i < lit));
    root.querySelector('.hh-mode')!.textContent = `${LABELS[ctx.mode]}${ctx.status === 'paused' ? ' ‖' : ''}`;
    setLevel(root, 1 - clamp01(p));
  }

  return {
    id: 'handheld',
    label: 'Retro Handheld',
    preview: `<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="10" y="3" width="28" height="42" rx="4" fill="#c9c7bd"/><rect x="13" y="6" width="22" height="17" rx="2" fill="#5c5f6a"/><rect x="15" y="8" width="18" height="13" fill="#9bbc0f"/><path d="M16 30h6M19 27v6" stroke="#2d2d2d" stroke-width="2.4"/><circle cx="31" cy="29" r="2.2" fill="var(--mode)"/><circle cx="27.5" cy="32.5" r="2.2" fill="var(--mode)"/></svg>`,
    mount(layer, ctx) {
      loadFont('VT323');
      const blocks = Array.from({ length: BLOCKS }, (_, i) => `<rect class="hh-block" x="${75 + i * 7.2}" y="89" width="6" height="7" rx="1"/>`).join('');
      layer.insertAdjacentHTML(
        'beforeend',
        `<svg class="handheld" viewBox="0 0 220 220" aria-hidden="true">
          <g class="hh-body">
            <path class="hh-case" d="M52 6H168A10 10 0 0 1 178 16V186A28 28 0 0 1 150 214H52A10 10 0 0 1 42 204V16A10 10 0 0 1 52 6Z"/>
            <rect class="hh-bezel" x="54" y="16" width="112" height="96" rx="8"/>
            <circle class="hh-led" cx="62" cy="50" r="2.5"/>
            <rect class="hh-screen" x="68" y="24" width="84" height="80" rx="2"/>
            <text class="hh-mode" x="110" y="38"></text>
            ${blocks}
            <text class="hh-brand" x="60" y="126">POMO BOY</text>
            <path class="hh-dpad" d="M70 146h10v-10h8v10h10v8H88v10h-8v-10H70Z"/>
            <circle class="hh-btn" cx="156" cy="146" r="9"/><circle class="hh-btn" cx="136" cy="158" r="9"/>
            <rect class="hh-pill" x="92" y="184" width="16" height="5" rx="2.5" transform="rotate(-25 100 186)"/>
            <rect class="hh-pill" x="114" y="184" width="16" height="5" rx="2.5" transform="rotate(-25 122 186)"/>
            <path class="hh-grill" d="M146 192l14-14M152 196l14-14M158 200l12-12"/>
          </g>
        </svg>`,
      );
      root = layer.querySelector('svg.handheld');
      draw(ctx.remainingMs / ctx.durationMs, ctx);
    },
    setProgress(p, ctx) {
      draw(p, ctx);
    },
    event(e, ctx) {
      if (!root) return;
      draw(ctx.remainingMs / ctx.durationMs, ctx);
      if (reducedMotion()) return;
      if (e === 'complete') animate(root.querySelector('.hh-screen')!, { opacity: [1, 0.3, 1, 0.3, 1], duration: 900, ease: 'linear' });
      if (e === 'start') animate(root.querySelector('.hh-led')!, { opacity: [0.3, 1], duration: 400, ease: 'out(2)' });
    },
    unmount() {
      root?.remove();
      root = null;
    },
  };
}
