import { animate } from 'animejs';
import { reducedMotion } from '../fx/anims';
import { clamp01, loadFont, setLevel } from './common';
import type { Face, FaceContext } from './types';

const COLS = 8;
const ROWS = 12;
const CELL = 12;
const X0 = 110 - (COLS * CELL) / 2;
const Y0 = 10;
const MINI = 6; // cell size in the NEXT preview

type Cell = [col: number, row: number];
type Piece = { cells: Cell[]; color: number };

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
function buildPieces(): Piece[] {
  const rand = mulberry32(7);
  const pieces: Piece[] = [];
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
const topRow = (p: Piece) => Math.min(...p.cells.map(([, r]) => r));
/** Complete rows once `n` pieces have landed. */
const FULL_ROWS = PIECES.map((_, n) => {
  const filled = new Array<number>(ROWS).fill(0);
  PIECES.slice(0, n).forEach((p) => p.cells.forEach(([, r]) => filled[r]++));
  return filled.filter((c) => c === COLS).length;
}).concat(ROWS);

/**
 * Where the stack is at fill level `l` (0–1): how many pieces have landed, and how many
 * rows above its slot the falling piece is. It enters with its bottom row showing and
 * drops a whole row at a time, like the real thing.
 */
export function tetrisState(l: number): { landed: number; dropRows: number } {
  const exact = clamp01(l) * PIECES.length;
  const landed = Math.min(PIECES.length, Math.floor(exact));
  if (landed === PIECES.length) return { landed, dropRows: 0 };
  const steps = topRow(PIECES[landed]) + 1;
  return { landed, dropRows: steps - Math.floor((exact - landed) * steps) };
}

const rects = (cells: Cell[], x0: number, y0: number, size: number, pad: number, cls = '') =>
  cells
    .map(([c, r]) => `<rect${cls ? ` class="${cls}"` : ''} x="${x0 + c * size + pad}" y="${y0 + r * size + pad}" width="${size - 2 * pad}" height="${size - 2 * pad}" rx="${size / 6}"/>`)
    .join('');

/** A Tetris well that fills with falling pieces as the session passes. */
export function tetrisFace(): Face {
  let root: SVGSVGElement | null = null;
  let groups: SVGGElement[] = [];
  let lastLanded = -1;
  let lastActive = -1;

  const level = (p: number, ctx: FaceContext) => (ctx.mode === 'focus' ? 1 - clamp01(p) : clamp01(p));

  function showNext(i: number) {
    const next = root!.querySelector<SVGGElement>('.tt-next-piece')!;
    const piece = PIECES[i];
    if (!piece) return next.replaceChildren();
    // Normalise to the piece's own 4x2 box, centred in the preview.
    const minC = Math.min(...piece.cells.map(([c]) => c));
    const minR = topRow(piece);
    const cells = piece.cells.map(([c, r]): Cell => [c - minC, r - minR]);
    const w = (Math.max(...cells.map(([c]) => c)) + 1) * MINI;
    next.setAttribute('class', `tt-next-piece tt-c${piece.color}`);
    next.innerHTML = rects(cells, 186 - w / 2, 34, MINI, 0.5);
  }

  function draw(l: number, running: boolean) {
    if (!root) return;
    const { landed, dropRows } = tetrisState(l);
    groups.forEach((g, i) => {
      g.style.display = i <= landed && i < PIECES.length ? '' : 'none';
      g.setAttribute('transform', i === landed ? `translate(0 ${-dropRows * CELL})` : '');
      // The falling piece shuffles side to side while it's clear of the stack.
      g.classList.toggle('tt-falling', i === landed && running && dropRows >= 3);
    });
    if (landed !== lastActive) {
      lastActive = landed;
      const ghost = root.querySelector('.tt-ghost')!;
      ghost.innerHTML = PIECES[landed] ? rects(PIECES[landed].cells, X0, Y0, CELL, 1.5) : '';
      showNext(landed + 1);
      root.querySelector('.tt-lines')!.textContent = String(FULL_ROWS[landed]);
    }
    // A piece just locked into place: flash it.
    if (running && landed === lastLanded + 1 && groups[lastLanded] && !reducedMotion()) {
      animate(groups[lastLanded].querySelectorAll('rect'), { opacity: [0.35, 1], duration: 380, ease: 'out(2)' });
    }
    lastLanded = landed;
    setLevel(root, l);
  }

  return {
    id: 'tetris',
    label: 'Tetris',
    preview: `<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="10" y="4" width="28" height="40" rx="2" fill="none" stroke="currentColor" stroke-opacity=".4" stroke-width="2"/><path d="M12 36h8v6h-8ZM20 36h8v6h-8Z" fill="var(--mode)"/><path d="M28 30h8v12h-8Z" fill="var(--blob2)"/><path d="M12 30h16v6H12Z" fill="var(--blob1)"/><path d="M20 10h8v6h8v6H20Z" fill="var(--blob3)"/></svg>`,
    mount(layer, ctx) {
      loadFont('VT323');
      const blocks = PIECES.map((piece) => {
        const cols = piece.cells.map(([c]) => c);
        // Shuffle toward the middle so the piece never leaves the well.
        const dx = Math.min(...cols) === 0 ? CELL : -CELL;
        return `<g class="tt-piece tt-c${piece.color}"><g class="tt-shift" style="--dx:${dx}px">${rects(piece.cells, X0, Y0, CELL, 0.8)}</g></g>`;
      }).join('');
      layer.insertAdjacentHTML(
        'beforeend',
        `<svg class="tetris" viewBox="0 0 220 220" aria-hidden="true">
          <defs><clipPath id="tt-well"><rect x="${X0}" y="${Y0}" width="${COLS * CELL}" height="${ROWS * CELL}"/></clipPath></defs>
          <rect class="tt-bg" x="${X0 - 4}" y="${Y0 - 4}" width="${COLS * CELL + 8}" height="${ROWS * CELL + 8}" rx="6"/>
          <g class="tt-hud">
            <rect class="tt-box" x="166" y="6" width="40" height="46" rx="5"/>
            <text class="tt-label" x="186" y="20">NEXT</text>
            <g class="tt-next-piece"></g>
            <rect class="tt-box" x="14" y="6" width="40" height="46" rx="5"/>
            <text class="tt-label" x="34" y="20">LINES</text>
            <text class="tt-lines" x="34" y="42">0</text>
          </g>
          <g class="tt-stack" clip-path="url(#tt-well)">
            <g class="tt-ghost"></g>
            ${blocks}
          </g>
          <text class="tt-banner" x="110" y="${Y0 + (ROWS * CELL) / 2}">TETRIS!</text>
        </svg>`,
      );
      root = layer.querySelector('svg.tetris');
      groups = Array.from(root!.querySelectorAll<SVGGElement>('.tt-piece'));
      draw(level(ctx.remainingMs / ctx.durationMs, ctx), ctx.status === 'running');
    },
    setProgress(p, ctx) {
      draw(level(p, ctx), ctx.status === 'running');
    },
    event(e, ctx) {
      if (!root) return;
      draw(level(ctx.remainingMs / ctx.durationMs, ctx), ctx.status === 'running');
      if (e !== 'complete' || reducedMotion()) return;
      // Line clear! Rows flash from the bottom up, then the banner pops.
      const rows = Array.from({ length: ROWS }, (_, r) => ROWS - 1 - r);
      rows.forEach((r, i) => {
        const y = String(Y0 + r * CELL + 0.8);
        const cells = Array.from(root!.querySelectorAll<SVGRectElement>('.tt-piece rect')).filter((el) => el.getAttribute('y') === y);
        if (cells.length) animate(cells, { opacity: [1, 0.15, 1], duration: 420, delay: i * 60, ease: 'inOutSine' });
      });
      animate(root.querySelector('.tt-banner')!, {
        opacity: [0, 1, 1, 0],
        scale: [0.4, 1.15, 1, 1],
        duration: 1600,
        delay: 300,
        ease: 'out(3)',
      });
    },
    unmount() {
      root?.remove();
      root = null;
      groups = [];
      lastLanded = lastActive = -1;
    },
  };
}
