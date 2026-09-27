import { animate } from 'animejs';
import { reducedMotion } from '../fx/anims';
import { loadFont } from './common';
import type { Face, FaceContext } from './types';

type Sprite = string[];

// 1-bit pixel art: '#' is an LCD pixel. Kept tiny and readable on purpose.
const EGG: Sprite = [
  '....####....',
  '...#....#...',
  '..#..##..#..',
  '..#......#..',
  '.#...#....#.',
  '.#.......##.',
  '.#.##.....#.',
  '.#........#.',
  '..#......#..',
  '...######...',
];
const BABY: Sprite = [
  '............',
  '...######...',
  '..#......#..',
  '.#........#.',
  '.#........#.',
  '.#........#.',
  '.#........#.',
  '..#......#..',
  '..########..',
  '..#.#..#.#..',
];
const ADULT: Sprite = [
  '.#..........#.',
  '.##........##.',
  '.#.########.#.',
  '..#........#..',
  '.#..........#.',
  '.#..........#.',
  '.#..........#.',
  '.#..........#.',
  '..#........#..',
  '...########...',
  '...#.#..#.#...',
];

type Eyes = 'open' | 'closed' | 'happy' | 'sad';
/** Eye pixels per body, as [col, row] pairs. */
const EYES: Record<'baby' | 'adult', Record<Eyes, [number, number][]>> = {
  baby: {
    open: [[4, 3], [4, 4], [7, 3], [7, 4]],
    closed: [[3, 4], [4, 4], [7, 4], [8, 4]],
    happy: [[3, 4], [4, 3], [5, 4], [6, 4], [7, 3], [8, 4]],
    sad: [[3, 3], [4, 4], [7, 4], [8, 3]],
  },
  adult: {
    open: [[4, 4], [4, 5], [9, 4], [9, 5]],
    closed: [[3, 5], [4, 5], [9, 5], [10, 5]],
    happy: [[3, 5], [4, 4], [5, 5], [8, 5], [9, 4], [10, 5]],
    sad: [[3, 4], [4, 5], [9, 5], [10, 4]],
  },
};
// A small 'u' smile.
const MOUTH = {
  baby: [[4, 6], [5, 7], [6, 7], [7, 6]] as [number, number][],
  adult: [[5, 7], [6, 8], [7, 8], [8, 7]] as [number, number][],
};

const LAPTOP: Sprite = ['.#####.', '.#...#.', '.#...#.', '.#####.', '#######'];
const ZZZ: Sprite = ['###', '..#', '.#.', '###'];
const HEART: Sprite = ['.#.#.', '#####', '.###.', '..#..'];
const SWEAT: Sprite = ['.#', '##', '##'];

const PX = 4; // viewBox units per pixel
const SCREEN = { x: 58, y: 60, w: 104, h: 92 };

/** One <path> for a sprite placed at pixel offset (ox, oy) from the pet origin. */
function pixels(sprite: Sprite | [number, number][], ox: number, oy: number, originX: number, originY: number): string {
  let d = '';
  const put = (c: number, r: number) => {
    d += `M${originX + (ox + c) * PX} ${originY + (oy + r) * PX}h${PX}v${PX}h-${PX}Z`;
  };
  if (typeof sprite[0] === 'string') {
    (sprite as Sprite).forEach((row, r) => [...row].forEach((ch, c) => ch === '#' && put(c, r)));
  } else (sprite as [number, number][]).forEach(([c, r]) => put(c, r));
  return d;
}

export function tamagotchiFace(): Face {
  let root: SVGSVGElement | null = null;
  let pet: SVGPathElement | null = null;
  let timer: number | undefined;
  let frame = 0;
  let mood: { kind: 'happy' | 'sad'; until: number } | null = null;
  let ctx: FaceContext;

  const stage = (c: FaceContext) => (c.totalPomodoros === 0 ? 'egg' : c.totalPomodoros < 10 ? 'baby' : 'adult');

  function draw() {
    if (!pet) return;
    const s = stage(ctx);
    const still = reducedMotion();
    const f = still ? 0 : frame % 2;
    const now = Date.now();
    if (mood && mood.until < now) mood = null;
    root?.setAttribute('data-stage', s);
    root?.setAttribute('data-mood', mood?.kind ?? (ctx.mode === 'long' ? 'sleeping' : ctx.mode === 'focus' && ctx.status === 'running' ? 'working' : 'idle'));

    if (s === 'egg') {
      const body = EGG;
      const x = SCREEN.x + (SCREEN.w - body[0].length * PX) / 2 + (still ? 0 : [0, -2, 0, 2][frame % 4]);
      pet.setAttribute('d', pixels(body, 0, 0, x, SCREEN.y + 8));
      return;
    }

    const body = s === 'baby' ? BABY : ADULT;
    const width = body[0].length;
    const breakTime = ctx.mode !== 'focus';
    const working = ctx.mode === 'focus' && ctx.status === 'running' && !mood;
    // Make room for the laptop beside the pet while working.
    const x0 = SCREEN.x + (SCREEN.w - width * PX) / 2 - (working ? 3 * PX : 0);

    let eyes: Eyes = 'open';
    let dy = 0;
    let extra = '';
    let mouth = true;
    if (mood?.kind === 'happy') {
      eyes = 'happy';
      dy = f ? -2 : 0; // jump
      extra = pixels(HEART, width, -1, x0, SCREEN.y + 6);
    } else if (mood?.kind === 'sad') {
      eyes = 'sad';
      mouth = false;
      extra = pixels(SWEAT, width - 1, 1, x0, SCREEN.y + 6);
    } else if (breakTime && ctx.mode === 'long') {
      eyes = 'closed';
      mouth = false;
      extra = f ? pixels(ZZZ, width, -2, x0, SCREEN.y + 6) : pixels(ZZZ, width - 1, -1, x0, SCREEN.y + 6);
    } else if (breakTime) {
      eyes = 'happy';
      dy = f ? -1 : 0; // bounce
    } else if (working) {
      dy = f ? -1 : 0; // typing bob
      extra = pixels(LAPTOP, width - 1, body.length - 5, x0, SCREEN.y + 6);
    } else if (frame % 8 === 7) {
      eyes = 'closed'; // blink
    }

    const kind = s === 'baby' ? 'baby' : 'adult';
    const oy = SCREEN.y + 6 + dy * PX;
    pet.setAttribute(
      'd',
      pixels(body, 0, 0, x0, oy) + pixels(EYES[kind][eyes], 0, 0, x0, oy) + (mouth ? pixels(MOUTH[kind], 0, 0, x0, oy) : '') + extra,
    );
  }

  return {
    id: 'tamagotchi',
    label: 'Tamagotchi',
    preview: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 3C13 3 7 14 7 26s7 19 17 19 17-7 17-19S35 3 24 3Z" fill="var(--mode)"/><rect x="13" y="14" width="22" height="18" rx="3" fill="#b9c7a5"/><path d="M20 18h8v2h2v6h-2v2h-8v-2h-2v-6h2Z" fill="#28331f"/><circle cx="17" cy="38" r="2" fill="currentColor" opacity=".5"/><circle cx="24" cy="39" r="2" fill="currentColor" opacity=".5"/><circle cx="31" cy="38" r="2" fill="currentColor" opacity=".5"/></svg>`,
    mount(layer, c) {
      ctx = c;
      loadFont('VT323');
      layer.insertAdjacentHTML(
        'beforeend',
        `<svg class="tama" viewBox="0 0 220 220" aria-hidden="true">
          <defs>
            <radialGradient id="tama-shell" cx="35%" cy="28%" r="80%">
              <stop offset="0%" class="ts-light"/><stop offset="100%" class="ts-dark"/>
            </radialGradient>
            <pattern id="tama-grid" width="4" height="4" patternUnits="userSpaceOnUse">
              <path d="M4 0H0V4" fill="none" stroke="#28331f" stroke-opacity=".06" stroke-width=".6"/>
            </pattern>
          </defs>
          <g class="tama-shake">
            <path class="tama-shell" d="M110 8C58 8 26 60 26 118c0 56 36 96 84 96s84-40 84-96C194 60 162 8 110 8Z" fill="url(#tama-shell)"/>
            <rect class="tama-bezel" x="${SCREEN.x - 8}" y="${SCREEN.y - 8}" width="${SCREEN.w + 16}" height="${SCREEN.h + 16}" rx="14"/>
            <rect class="tama-screen" x="${SCREEN.x}" y="${SCREEN.y}" width="${SCREEN.w}" height="${SCREEN.h}" rx="6"/>
            <rect x="${SCREEN.x}" y="${SCREEN.y}" width="${SCREEN.w}" height="${SCREEN.h}" rx="6" fill="url(#tama-grid)"/>
            <path class="tama-pet"/>
            <circle class="tama-btn" cx="84" cy="186" r="7"/><circle class="tama-btn" cx="110" cy="192" r="7"/><circle class="tama-btn" cx="136" cy="186" r="7"/>
          </g>
        </svg>`,
      );
      root = layer.querySelector('svg.tama');
      pet = root!.querySelector('.tama-pet');
      draw();
      timer = window.setInterval(() => {
        frame++;
        draw();
      }, 480);
    },
    setProgress(_p, c) {
      const changed = c.mode !== ctx.mode || c.status !== ctx.status || c.totalPomodoros !== ctx.totalPomodoros;
      ctx = c;
      if (changed) draw();
    },
    event(e, c) {
      const hatching = stage(ctx) === 'egg' && stage(c) !== 'egg';
      ctx = c;
      if (e === 'complete') mood = { kind: 'happy', until: Date.now() + 4000 };
      if (e === 'abandon') mood = { kind: 'sad', until: Date.now() + 3000 };
      draw();
      if (!root || reducedMotion()) return;
      const shake = root.querySelector('.tama-shake')!;
      if (hatching) animate(shake, { rotate: [0, -6, 6, -4, 4, 0], duration: 900, ease: 'inOutSine' });
      else if (e === 'complete') animate(shake, { y: [0, -6, 0], duration: 450, ease: 'out(3)' });
      else if (e === 'start') animate(shake, { scale: [1, 0.97, 1], duration: 300, ease: 'out(2)' });
    },
    unmount() {
      clearInterval(timer);
      root?.remove();
      root = pet = null;
    },
  };
}
