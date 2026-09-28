import { animate } from 'animejs';
import { reducedMotion } from '../fx/anims';
import { clamp01, setLevel } from './common';
import type { Face, FaceContext } from './types';

const CELLS = 5;

/** Mouth shape per mood. */
const MOUTHS = {
  working: 'M103 83h14',
  idle: 'M102 82q8 5 16 0',
  charging: 'M106 83q4 3 8 0',
  happy: 'M100 80q10 10 20 0Z',
} as const;

/** A little robot: spends its battery while you work, recharges on breaks, cheers when you finish. */
export function robotFace(): Face {
  let root: SVGSVGElement | null = null;
  let happyUntil = 0;

  // Focus drains the battery; a break charges it back up, so the two join up seamlessly.
  const charge = (p: number, ctx: FaceContext) => (ctx.mode === 'focus' ? clamp01(p) : 1 - clamp01(p));

  function state(ctx: FaceContext): keyof typeof MOUTHS {
    if (Date.now() < happyUntil) return 'happy';
    if (ctx.mode !== 'focus') return 'charging';
    return ctx.status === 'running' ? 'working' : 'idle';
  }

  function draw(p: number, ctx: FaceContext) {
    if (!root) return;
    const level = charge(p, ctx);
    const mood = state(ctx);
    const charging = mood === 'charging';
    // Charging blinks the cell being filled; working blinks the last cell when it's running low.
    const lit = charging ? Math.floor(level * CELLS) : Math.ceil(level * CELLS);
    const blink = charging ? lit : lit === 1 ? 0 : -1;
    root.querySelectorAll('.rb-cell').forEach((c, i) => {
      c.classList.toggle('on', i < lit);
      c.classList.toggle('blink', i === blink);
    });
    root.setAttribute('data-state', mood);
    root.querySelector('.rb-mouth')!.setAttribute('d', MOUTHS[mood]);
    setLevel(root, level);
  }

  return {
    id: 'robot',
    label: 'Robot Pet',
    preview: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 4v6" stroke="currentColor" stroke-width="2"/><circle cx="24" cy="4" r="3" fill="var(--mode)"/><rect x="10" y="10" width="28" height="20" rx="6" fill="currentColor" opacity=".85"/><rect x="14" y="14" width="20" height="12" rx="3" fill="#1d2230"/><rect x="18" y="18" width="3" height="5" rx="1.5" fill="#7ee0ff"/><rect x="27" y="18" width="3" height="5" rx="1.5" fill="#7ee0ff"/><rect x="14" y="32" width="20" height="12" rx="4" fill="currentColor" opacity=".6"/><rect x="18" y="36" width="12" height="4" rx="1" fill="var(--mode)"/></svg>`,
    mount(layer, ctx) {
      const cells = Array.from({ length: CELLS }, (_, i) => `<rect class="rb-cell" x="${95 + i * 6.4}" y="128" width="5" height="10" rx="1"/>`).join('');
      layer.insertAdjacentHTML(
        'beforeend',
        `<svg class="robot" viewBox="0 0 220 220" aria-hidden="true">
          <g class="rb-bot"><g class="rb-bob">
            <g class="rb-antenna-g">
              <line class="rb-antenna" x1="110" y1="30" x2="110" y2="14"/>
              <circle class="rb-bulb" cx="110" cy="12" r="6"/>
            </g>
            <rect class="rb-ear" x="58" y="56" width="8" height="22" rx="3"/><rect class="rb-ear" x="154" y="56" width="8" height="22" rx="3"/>
            <rect class="rb-head" x="64" y="28" width="92" height="78" rx="20"/>
            <rect class="rb-screen" x="74" y="40" width="72" height="54" rx="10"/>
            <g class="rb-eyes">
              <rect class="rb-eye" x="90" y="54" width="10" height="18" rx="5"/>
              <rect class="rb-eye" x="120" y="54" width="10" height="18" rx="5"/>
            </g>
            <path class="rb-happy" d="M88 66l6-8 6 8M118 66l6-8 6 8"/>
            <path class="rb-sleep" d="M88 64h12M118 64h12"/>
            <path class="rb-mouth"/>
            <g class="rb-bolt"><path d="M150 44l-8 12h6l-4 10 10-14h-6l4-8Z"/></g>
            <g class="rb-zs"><text class="rb-z" x="158" y="30">z</text><text class="rb-z" x="166" y="20">z</text></g>
            <rect class="rb-neck" x="100" y="106" width="20" height="8" rx="2"/>
            <rect class="rb-arm rb-arm-l" x="58" y="118" width="14" height="32" rx="7"/>
            <rect class="rb-arm rb-arm-r" x="148" y="118" width="14" height="32" rx="7"/>
            <rect class="rb-body" x="74" y="114" width="72" height="42" rx="14"/>
            <rect class="rb-battery" x="92" y="125" width="36" height="16" rx="3"/>
            <rect class="rb-battery-tip" x="128" y="130" width="3" height="6" rx="1"/>
            ${cells}
          </g>
            <rect class="rb-foot" x="82" y="156" width="22" height="10" rx="5"/><rect class="rb-foot" x="116" y="156" width="22" height="10" rx="5"/>
          </g>
        </svg>`,
      );
      root = layer.querySelector('svg.robot');
      draw(ctx.remainingMs / ctx.durationMs, ctx);
    },
    setProgress(p, ctx) {
      draw(p, ctx);
    },
    event(e, ctx) {
      if (!root) return;
      if (e === 'complete') happyUntil = Date.now() + 4000;
      draw(ctx.remainingMs / ctx.durationMs, ctx);
      if (reducedMotion()) return;
      if (e === 'complete') animate(root.querySelector('.rb-bot')!, { y: [0, -12, 0, -6, 0], duration: 900, ease: 'out(2)' });
      if (e === 'start') {
        animate(root.querySelector('.rb-bulb')!, { scale: [1, 1.6, 1], duration: 500, ease: 'out(3)' });
        animate(root.querySelector('.rb-antenna-g')!, { rotate: [0, 14, -10, 6, -3, 0], duration: 900, ease: 'outSine' }); // boing
      }
    },
    unmount() {
      root?.remove();
      root = null;
    },
  };
}
