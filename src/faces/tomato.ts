import { animate } from 'animejs';
import { reducedMotion } from '../fx/anims';
import type { Face, FaceContext } from './types';

const CX = 110;
const CY = 124;

/** Minute ticks and labels (0–55) around the dial, like a kitchen timer. */
function dialMarks(): string {
  let s = '';
  for (let m = 0; m < 60; m++) {
    const major = m % 5 === 0;
    const a = (m * 6 * Math.PI) / 180;
    const r1 = 80;
    const r2 = major ? 71 : 75;
    s += `<line x1="${CX + r1 * Math.sin(a)}" y1="${CY - r1 * Math.cos(a)}" x2="${CX + r2 * Math.sin(a)}" y2="${CY - r2 * Math.cos(a)}" class="${major ? 'tick major' : 'tick'}"/>`;
    if (major) {
      const rt = 61;
      s += `<text x="${CX + rt * Math.sin(a)}" y="${CY - rt * Math.cos(a)}" class="tick-label">${m}</text>`;
    }
  }
  return s;
}

const TOMATO_SVG = `
  <svg class="tomato" viewBox="0 0 220 220" aria-hidden="true">
    <defs>
      <radialGradient id="tomato-body" cx="38%" cy="32%" r="75%">
        <stop offset="0%" class="tb-light"/>
        <stop offset="60%" class="tb-mid"/>
        <stop offset="100%" class="tb-dark"/>
      </radialGradient>
    </defs>
    <g class="tomato-wobble">
      <ellipse class="tomato-shadow" cx="${CX}" cy="${CY + 92}" rx="70" ry="8"/>
      <g class="tomato-tremble">
      <path class="tomato-body" d="M110 38c-52 0-94 30-94 86 0 52 42 90 94 90s94-38 94-90c0-56-42-86-94-86Z" fill="url(#tomato-body)"/>
      <g class="tomato-dial">${dialMarks()}</g>
      <ellipse class="tomato-shine" cx="72" cy="78" rx="18" ry="10" transform="rotate(-24 72 78)"/>
      <g class="tomato-leaves">
        <path d="M110 44c-10-10-28-12-40-6 12 2 22 6 28 12-14 0-24 6-30 14 14-6 28-8 42-6 14-2 28 0 42 6-6-8-16-14-30-14 6-6 16-10 28-12-12-6-30-4-40 6Z"/>
        <path class="tomato-stem" d="M110 44v-14" />
      </g>
      <!-- fixed marker the dial turns toward; drawn over the leaves so it's always visible -->
      <path class="tomato-pointer" d="M110 49l-5.5-9h11Z"/>
      </g>
      <!-- "Ring" marks either side of the top, shown when the timer goes off -->
      <g class="tomato-ring">
        <path d="M38 44q-8 8 -10 18M28 36q-12 12 -15 26"/>
        <path d="M182 44q8 8 10 18M192 36q12 12 15 26"/>
      </g>
    </g>
  </svg>`;

export function tomatoFace(): Face {
  let root: SVGSVGElement | null = null;
  let dial: SVGGElement | null = null;
  let angle = 0;
  let minute = -1; // whole minutes left, for the once-a-minute tick

  const angleFor = (ctx: FaceContext) => -(ctx.remainingMs / 60_000) * 6; // 6° per minute, 0 at the pointer
  const setAngle = (a: number) => {
    angle = a;
    dial?.setAttribute('transform', `rotate(${a} ${CX} ${CY})`);
  };
  // Leaves droop a little on breaks. SVG transform attribute: pivots in viewBox units everywhere.
  const droop = (ctx: FaceContext) =>
    root
      ?.querySelector('.tomato-leaves')
      ?.setAttribute('transform', ctx.mode === 'focus' ? '' : 'translate(110 47) scale(1 .8) translate(-110 -44)');

  return {
    id: 'tomato',
    label: 'Tomato',
    preview: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 12c-11 0-19 6-19 17 0 10 8 16 19 16s19-6 19-16c0-11-8-17-19-17Z" fill="var(--mode)"/><path d="M24 12l-1.5-2.5h3Z" fill="currentColor"/><path d="M24 11c-3-3-8-3-11-1 4 0 6 2 8 3-3 0-6 1-8 3 4-2 8-2 11-2s7 0 11 2c-2-2-5-3-8-3 2-1 4-3 8-3-3-2-8-2-11 1Z" fill="#6bbf7a"/></svg>`,
    mount(layer, ctx) {
      layer.insertAdjacentHTML('beforeend', TOMATO_SVG);
      root = layer.querySelector('svg.tomato');
      dial = root!.querySelector('.tomato-dial');
      setAngle(angleFor(ctx));
      droop(ctx);
    },
    setProgress(_p, ctx) {
      setAngle(angleFor(ctx));
      const running = ctx.status === 'running';
      // Trembles through the last minute, like it's about to go off.
      root?.toggleAttribute('data-urgent', running && ctx.remainingMs > 0 && ctx.remainingMs <= 60_000);
      // A small jolt each time a minute clicks past on the dial.
      const m = Math.ceil(ctx.remainingMs / 60_000);
      if (running && minute !== -1 && m < minute && root && !reducedMotion()) {
        animate(root.querySelector('.tomato-tremble')!, { rotate: [0, -1.5, 1, 0], duration: 320, ease: 'out(2)' });
      }
      minute = m;
    },
    event(e, ctx) {
      if (!root || reducedMotion()) {
        if (e === 'mode') droop(ctx);
        return;
      }
      const wobble = root.querySelector('.tomato-wobble')!;
      if (e === 'start') {
        // A little wind-up twist, like setting a real kitchen timer.
        const target = angleFor(ctx);
        const obj = { a: target - 25 };
        animate(obj, { a: target, duration: 900, ease: 'outElastic(1, .5)', onUpdate: () => setAngle(obj.a) });
        animate(wobble, { rotate: [0, -3, 2, 0], duration: 600, ease: 'inOutSine' });
      } else if (e === 'complete') {
        animate(wobble, { rotate: [0, -7, 7, -5, 5, -3, 3, 0], duration: 1200, ease: 'inOutSine' });
        animate(wobble, { y: [0, -8, 0], duration: 500, ease: 'out(3)' });
        animate(root.querySelectorAll('.tomato-ring path'), { opacity: [0, 1, 0, 1, 0, 1, 0], duration: 1300, ease: 'linear' });
      } else if (e === 'mode') {
        droop(ctx);
        const from = angle;
        const obj = { a: from };
        animate(obj, { a: angleFor(ctx), duration: 900, ease: 'inOut(3)', onUpdate: () => setAngle(obj.a) });
      } else if (e === 'abandon') {
        animate(wobble, { rotate: [0, 4, 0], duration: 500, ease: 'out(2)' });
      }
    },
    unmount() {
      root?.remove();
      root = dial = null;
      minute = -1;
    },
  };
}
