import { animate } from 'animejs';
import { reducedMotion } from '../fx/anims';
import { clamp01, setLevel } from './common';
import type { Face, FaceContext } from './types';

const CX = 110;
const CY = 84;
const R = 66;
const C = 2 * Math.PI * R;

/** A hamster runs its wheel during focus (progress on the rim) and naps beside it on breaks. */
export function hamsterFace(): Face {
  let root: SVGSVGElement | null = null;

  const done = (p: number, ctx: FaceContext) => (ctx.mode === 'focus' ? 1 - clamp01(p) : 1);

  function draw(p: number, ctx: FaceContext) {
    if (!root) return;
    const d = done(p, ctx);
    root.querySelector<SVGCircleElement>('.hw-progress')!.style.strokeDashoffset = String(C * (1 - d));
    root.setAttribute('data-state', ctx.mode !== 'focus' ? 'napping' : ctx.status === 'running' ? 'running' : 'idle');
    setLevel(root, d);
  }

  const spokes = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    return `<line x1="${CX}" y1="${CY}" x2="${CX + (R - 4) * Math.cos(a)}" y2="${CY + (R - 4) * Math.sin(a)}"/>`;
  }).join('');

  const hamster = `
    <g class="hw-hamster">
      <ellipse class="hw-body" cx="0" cy="0" rx="22" ry="16"/>
      <ellipse class="hw-belly" cx="6" cy="5" rx="12" ry="9"/>
      <circle class="hw-ear" cx="10" cy="-14" r="5"/>
      <circle class="hw-eye" cx="15" cy="-4" r="2.4"/>
      <path class="hw-shut" d="M12 -4q3 2 6 0"/>
      <circle class="hw-nose" cx="22" cy="0" r="2"/>
      <ellipse class="hw-leg hw-leg-a" cx="-8" cy="15" rx="4" ry="3"/>
      <ellipse class="hw-leg hw-leg-b" cx="10" cy="15" rx="4" ry="3"/>
    </g>`;

  return {
    id: 'hamster',
    label: 'Hamster Wheel',
    preview: `<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="20" r="15" fill="none" stroke="currentColor" stroke-opacity=".45" stroke-width="2"/><path d="M24 5a15 15 0 0 1 15 15" fill="none" stroke="var(--mode)" stroke-width="3"/><path d="M14 44l10-24 10 24" fill="none" stroke="currentColor" stroke-opacity=".45" stroke-width="2"/><ellipse cx="24" cy="30" rx="7" ry="5" fill="#e0b584"/><circle cx="28" cy="28" r="1" fill="#1d2230"/></svg>`,
    mount(layer, ctx) {
      layer.insertAdjacentHTML(
        'beforeend',
        `<svg class="hamster" viewBox="0 0 220 220" aria-hidden="true">
          <path class="hw-stand" d="M110 ${CY}L78 166M110 ${CY}L142 166M66 166H154"/>
          <circle class="hw-rim" cx="${CX}" cy="${CY}" r="${R}"/>
          <circle class="hw-progress" cx="${CX}" cy="${CY}" r="${R}" transform="rotate(-90 ${CX} ${CY})" style="stroke-dasharray:${C}"/>
          <g class="hw-spokes">${spokes}</g>
          <circle class="hw-hub" cx="${CX}" cy="${CY}" r="6"/>
          <g class="hw-runner" transform="translate(${CX} ${CY + R - 20})">${hamster}</g>
          <g class="hw-napper" transform="translate(172 154) scale(.8)">${hamster}<text class="hw-z" x="16" y="-22">z</text><text class="hw-z" x="24" y="-32">z</text></g>
        </svg>`,
      );
      root = layer.querySelector('svg.hamster');
      draw(ctx.remainingMs / ctx.durationMs, ctx);
    },
    setProgress(p, ctx) {
      draw(p, ctx);
    },
    event(e, ctx) {
      if (!root) return;
      draw(ctx.remainingMs / ctx.durationMs, ctx);
      if (reducedMotion()) return;
      if (e === 'complete') animate(root.querySelector('.hw-runner .hw-hamster')!, { y: [0, -18, 0], duration: 600, ease: 'out(3)' });
    },
    unmount() {
      root?.remove();
      root = null;
    },
  };
}
