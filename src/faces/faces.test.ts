import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FaceContext } from './types';

// Static artwork only: no anime.js tweens in these tests.
vi.mock('../fx/anims', () => ({ reducedMotion: () => true }));

const { tetrisFace, tetrisState } = await import('./tetris');
const { handheldFace } = await import('./handheld');
const { tomatoFace } = await import('./tomato');
const { potionFace } = await import('./potion');
const { plantFace } = await import('./plant');
const { spaceshipFace } = await import('./spaceship');

const MIN = 60_000;
const ctx = (over: Partial<FaceContext> = {}): FaceContext => ({
  mode: 'focus',
  status: 'running',
  remainingMs: 25 * MIN,
  durationMs: 25 * MIN,
  totalPomodoros: 0,
  ...over,
});
const at = (share: number, over: Partial<FaceContext> = {}) => ctx({ remainingMs: share * 25 * MIN, ...over });

let layer: HTMLElement;
function mount<F extends { mount(l: HTMLElement, c: FaceContext): void }>(face: F, c: FaceContext) {
  layer = document.createElement('div');
  document.body.append(layer);
  face.mount(layer, c);
  return face;
}
afterEach(() => layer?.remove());

describe('tetris', () => {
  it('drops the falling piece a whole row at a time, then lands it', () => {
    const start = tetrisState(0);
    expect(start.landed).toBe(0);
    expect(start.dropRows).toBeGreaterThan(1);
    const drops = Array.from({ length: 50 }, (_, i) => tetrisState((i / 50) * (1 / 24)).dropRows);
    drops.forEach((d, i) => {
      expect(Number.isInteger(d)).toBe(true);
      if (i) expect(d).toBeLessThanOrEqual(drops[i - 1]);
    });
    expect(tetrisState(1 / 24)).toMatchObject({ landed: 1 });
    expect(tetrisState(1)).toEqual({ landed: 24, dropRows: 0 });
  });

  it('shows a ghost where the piece will land, the next piece and full lines', () => {
    const face = mount(tetrisFace(), at(0.5));
    const svg = layer.querySelector('svg.tetris')!;
    expect(svg.querySelectorAll('.tt-ghost rect')).toHaveLength(4);
    expect(svg.querySelectorAll('.tt-next-piece rect')).toHaveLength(4);
    // Halfway: 12 of 24 pieces have landed, which fills the bottom 6 rows.
    expect(svg.querySelector('.tt-lines')!.textContent).toBe('6');
    face.setProgress(0, at(0));
    expect(svg.querySelector('.tt-lines')!.textContent).toBe('12');
    expect(svg.querySelectorAll('.tt-ghost rect')).toHaveLength(0);
    expect(svg.querySelectorAll('.tt-next-piece rect')).toHaveLength(0);
  });

  it('only shuffles the falling piece while running and clear of the stack', () => {
    const face = mount(tetrisFace(), at(1 - 22.01 / 24)); // a piece just entering the top rows
    const falling = () => layer.querySelectorAll('.tt-falling').length;
    expect(tetrisState(22.01 / 24).dropRows).toBeLessThan(3);
    expect(falling()).toBe(0);
    face.setProgress(1 - 0.01 / 24, at(1 - 0.01 / 24)); // first piece, high above the floor
    expect(falling()).toBe(1);
    face.setProgress(1 - 0.01 / 24, at(1 - 0.01 / 24, { status: 'paused' }));
    expect(falling()).toBe(0);
  });
});

describe('retro handheld', () => {
  it('puts the chomper just past the time left, chomping only while running', () => {
    const face = mount(handheldFace(), at(0.5));
    const svg = layer.querySelector('svg.handheld')!;
    expect(svg.querySelector('.hh-chomper')!.getAttribute('transform')).toBe('translate(107 89)');
    expect(svg.classList.contains('running')).toBe(true);
    face.setProgress(1, at(1, { status: 'paused' }));
    expect(svg.querySelector('.hh-chomper')!.getAttribute('transform')).toBe('translate(143 89)');
    expect(svg.classList.contains('running')).toBe(false);
  });
});

describe('tomato', () => {
  it('trembles through the last minute while running', () => {
    const face = mount(tomatoFace(), ctx({ remainingMs: 5 * MIN }));
    const svg = layer.querySelector('svg.tomato')!;
    face.setProgress(0.1, ctx({ remainingMs: 5 * MIN }));
    expect(svg.hasAttribute('data-urgent')).toBe(false);
    face.setProgress(0.02, ctx({ remainingMs: 40_000 }));
    expect(svg.hasAttribute('data-urgent')).toBe(true);
    face.setProgress(0.02, ctx({ remainingMs: 40_000, status: 'paused' }));
    expect(svg.hasAttribute('data-urgent')).toBe(false);
  });
});

describe('potion', () => {
  it('glows brighter as it fills', () => {
    const face = mount(potionFace(), at(0.9));
    const aura = layer.querySelector<SVGElement>('.po-aura')!;
    const dim = Number(aura.style.opacity);
    face.setProgress(0.1, at(0.1));
    expect(Number(aura.style.opacity)).toBeGreaterThan(dim);
  });
});

describe('plant buddy', () => {
  it('knows the mode, so petals only fall on breaks', () => {
    const face = mount(plantFace(), ctx());
    const svg = layer.querySelector('svg.plant')!;
    expect(svg.getAttribute('data-mode')).toBe('focus');
    face.event!('mode', ctx({ mode: 'short' }));
    expect(svg.getAttribute('data-mode')).toBe('short');
  });
});

describe('spaceship', () => {
  it('starts at the front of the orbit, in front of the planet', () => {
    mount(spaceshipFace(), ctx());
    expect(layer.querySelector('.ss-front .ss-ship')).not.toBeNull();
    expect(layer.querySelector('.ss-ship')!.getAttribute('transform')).toMatch(/^translate\(110 124\)/);
  });
});
