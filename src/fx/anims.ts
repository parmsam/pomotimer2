import { animate, createTimeline, stagger, utils, type JSAnimation } from 'animejs';

const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
export const reducedMotion = () => reducedQuery.matches;

/** Slow, endless drift of the background color blobs. */
export function driftBlobs(): void {
  const blobs = document.querySelectorAll<HTMLElement>('.blob');
  let anims: JSAnimation[] = [];
  const run = () => {
    anims.forEach((a) => a.revert());
    anims = [];
    if (reducedMotion()) return;
    blobs.forEach((el, i) => {
      anims.push(
        animate(el, {
          x: () => utils.random(-12, 12) + 'vmax',
          y: () => utils.random(-10, 10) + 'vmax',
          scale: () => utils.random(85, 120) / 100,
          duration: () => utils.random(14000, 22000),
          delay: i * 1200,
          ease: 'inOutSine',
          loop: true,
          alternate: true,
        }),
      );
    });
  };
  run();
  reducedQuery.addEventListener('change', run);
}

export function slidePill(pill: HTMLElement, target: HTMLElement, instant = false): void {
  const x = target.offsetLeft;
  const width = target.offsetWidth;
  if (instant || reducedMotion()) {
    utils.set(pill, { x, width });
    return;
  }
  animate(pill, { x, width, duration: 650, ease: 'out(4)' });
}

export function press(el: HTMLElement): void {
  if (reducedMotion()) return;
  animate(el, {
    scale: [{ to: 0.92, duration: 90, ease: 'out(2)' }, { to: 1, duration: 500, ease: 'outElastic(1, .45)' }],
  });
}

/** Rolls a single timer character in from above. */
export function rollChar(el: HTMLElement, direction: 1 | -1 = 1): void {
  if (reducedMotion()) return;
  animate(el, {
    y: [`${-40 * direction}%`, '0%'],
    opacity: [0, 1],
    filter: ['blur(4px)', 'blur(0px)'],
    duration: 420,
    ease: 'out(3)',
  });
}

/** Swaps text with a quick fade/slide. */
export function swapText(el: HTMLElement, text: string): void {
  if (el.textContent === text) return;
  if (reducedMotion()) {
    el.textContent = text;
    return;
  }
  animate(el, {
    y: [0, -8],
    opacity: [1, 0],
    duration: 140,
    ease: 'in(2)',
    onComplete: () => {
      el.textContent = text;
      animate(el, { y: [8, 0], opacity: [0, 1], duration: 260, ease: 'out(3)' });
    },
  });
}

/** Animates a numeric progress value (0..1), calling `apply` each frame. */
export function tweenProgress(from: number, to: number, apply: (p: number) => void): JSAnimation | null {
  if (reducedMotion()) {
    apply(to);
    return null;
  }
  const obj = { p: from };
  return animate(obj, { p: to, duration: 1100, ease: 'inOut(3)', onUpdate: () => apply(obj.p) });
}

/** Particle burst + ring pulse when a session completes. */
export function celebrate(burst: HTMLElement, dial: HTMLElement): void {
  if (reducedMotion()) return;
  const count = 22;
  const dots = Array.from({ length: count }, () => {
    const i = document.createElement('i');
    burst.appendChild(i);
    return i;
  });
  const radius = dial.offsetWidth * 0.5;
  createTimeline({ onComplete: () => dots.forEach((d) => d.remove()) })
    .add(dial, { scale: [1, 1.05, 1], duration: 700, ease: 'out(3)' }, 0)
    .add(
      dots,
      {
        x: (_?: unknown, i = 0) => Math.cos((i / count) * Math.PI * 2) * radius * utils.random(0.9, 1.35, 2),
        y: (_?: unknown, i = 0) => Math.sin((i / count) * Math.PI * 2) * radius * utils.random(0.9, 1.35, 2),
        scale: [{ from: 0, to: () => utils.random(0.6, 1.4, 2) }, { to: 0 }],
        opacity: [1, 0],
        duration: 1400,
        ease: 'out(4)',
        delay: stagger(12),
      },
      0,
    );
}

export function openDrawer(drawer: HTMLElement, scrim: HTMLElement): void {
  drawer.hidden = false;
  scrim.hidden = false;
  if (reducedMotion()) return;
  animate(scrim, { opacity: [0, 1], duration: 300, ease: 'out(2)' });
  animate(drawer, { x: ['100%', '0%'], duration: 600, ease: 'out(4)' });
  animate(drawer.querySelectorAll('.section'), {
    x: [30, 0],
    opacity: [0, 1],
    duration: 500,
    delay: stagger(50, { start: 120 }),
    ease: 'out(3)',
  });
}

export function closeDrawer(drawer: HTMLElement, scrim: HTMLElement): void {
  const done = () => {
    drawer.hidden = true;
    scrim.hidden = true;
  };
  if (reducedMotion()) return done();
  animate(scrim, { opacity: 0, duration: 250, ease: 'in(2)' });
  animate(drawer, { x: '100%', duration: 350, ease: 'in(3)', onComplete: done });
}

export function entrance(): void {
  if (reducedMotion()) return;
  animate('.topbar, .modes, .dial, .controls, .cycle', {
    y: [24, 0],
    opacity: [0, 1],
    duration: 900,
    delay: stagger(90),
    ease: 'out(4)',
  });
}
