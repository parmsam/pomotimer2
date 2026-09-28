import { animate } from 'animejs';
import { reducedMotion } from '../fx/anims';
import { clamp01, setLevel } from './common';
import type { Face, FaceContext } from './types';

const COLS = 8;
const ROWS = 12;
const CELL = 12;
const X0 = 110 - (COLS * CELL) / 2;
const Y0 = 10;

type Cell = [col: number, row: number];

/** Deterministic PRNG so the stack looks the same every time. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Tiles the well with tetrominoes, bottom-up: each 4x2 area splits into I+I, O+O or an
 * L+J pair. Returned in the order they "land".
 */
function buildPieces(): { cells: Cell[]; color: number }[] {
  const rand = mulberry32(7);
  const pieces: { cells: Cell[]; color: number }[] = [];
  for (let by = ROWS - 2; by >= 0; by -= 2) {
    for (let bx = 0; bx < COLS; bx += 4) {
      const at = (c: number, r: number): Cell => [bx + c, by + r];
      const kind = Math.floor(rand() * 3);
      const pair: Cell[][] =
        kind === 0
          ? [[at(0, 1), at(1, 1), at(2, 1), at(3, 1)], [at(0, 0), at(1, 0), at(2, 0), at(3, 0)]] // I + I
          : kind === 1
            ? [[at(0, 0), at(1, 0), at(0, 1), at(1, 1)], [at(2, 0), at(3, 0), at(2, 1), at(3, 1)]] // O + O
            : [[at(3, 0), at(1, 1), at(2, 1), at(3, 1)], [at(0, 0), at(1, 0), at(2, 0), at(0, 1)]]; // J + L
      for (const cells of pair) pieces.push({ cells, color: Math.floor(rand() * 4) });
    }
  }
  return pieces;
}

const PIECES = buildPieces();

/** A Tetris well that fills with falling pieces as the session passes. */
export function tetrisFace(): Face {
  let root: SVGSVGElement | null = null;
  let groups: SVGGElement[] = [];

  const level = (p: number, ctx: FaceContext) => (ctx.mode === 'focus' ? 1 - clamp01(p) : clamp01(p));

  function draw(l: number) {
    if (!root) return;
    const exact = l * PIECES.length;
    const landed = Math.floor(exact);
    groups.forEach((g, i) => {
      if (i < landed) {
        g.style.display = '';
        g.setAttribute('transform', '');
      } else if (i === landed && l < 1) {
        // The next piece falls from the top toward its slot over its share of the session.
        const topRow = Math.min(...PIECES[i].cells.map(([, r]) => r));
        const drop = (topRow + 2) * CELL * (1 - (exact - landed));
        g.style.display = '';
        g.setAttribute('transform', `translate(0 ${-drop})`);
      } else g.style.display = 'none';
    });
    setLevel(root, l);
  }

  return {
    id: 'tetris',
    label: 'Tetris',
    preview: `<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="10" y="4" width="28" height="40" rx="2" fill="none" stroke="currentColor" stroke-opacity=".4" stroke-width="2"/><path d="M12 36h8v6h-8ZM20 36h8v6h-8Z" fill="var(--mode)"/><path d="M28 30h8v12h-8Z" fill="var(--blob2)"/><path d="M12 30h16v6H12Z" fill="var(--blob1)"/><path d="M20 10h8v6h8v6H20Z" fill="var(--blob3)"/></svg>`,
    mount(layer, ctx) {
      const blocks = PIECES.map(
        (piece) =>
          `<g class="tt-piece tt-c${piece.color}">${piece.cells
            .map(([c, r]) => `<rect x="${X0 + c * CELL + 0.8}" y="${Y0 + r * CELL + 0.8}" width="${CELL - 1.6}" height="${CELL - 1.6}" rx="2"/>`)
            .join('')}</g>`,
      ).join('');
      layer.insertAdjacentHTML(
        'beforeend',
        `<svg class="tetris" viewBox="0 0 220 220" aria-hidden="true">
          <defs><clipPath id="tt-well"><rect x="${X0}" y="${Y0}" width="${COLS * CELL}" height="${ROWS * CELL}"/></clipPath></defs>
          <rect class="tt-bg" x="${X0 - 4}" y="${Y0 - 4}" width="${COLS * CELL + 8}" height="${ROWS * CELL + 8}" rx="6"/>
          <g class="tt-stack" clip-path="url(#tt-well)">${blocks}</g>
        </svg>`,
      );
      root = layer.querySelector('svg.tetris');
      groups = Array.from(root!.querySelectorAll<SVGGElement>('.tt-piece'));
      draw(level(ctx.remainingMs / ctx.durationMs, ctx));
    },
    setProgress(p, ctx) {
      draw(level(p, ctx));
    },
    event(e) {
      if (!root || reducedMotion()) return;
      if (e === 'complete') animate(root.querySelector('.tt-stack')!, { opacity: [1, 0.2, 1, 0.2, 1], duration: 800, ease: 'linear' }); // line clear!
    },
    unmount() {
      root?.remove();
      root = null;
      groups = [];
    },
  };
}
