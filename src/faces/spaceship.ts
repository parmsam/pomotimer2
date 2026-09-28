import { animate } from 'animejs';
import { reducedMotion } from '../fx/anims';
import { clamp01, setLevel } from './common';
import type { Face } from './types';

// A tilted orbit (ellipse) around a ringed planet, seen at an angle.
const CX = 110;
const CY = 82;
const RX = 92;
const RY = 34;
const STARS: [number, number, number][] = [
  [20, 24, 1.4], [46, 150, 1], [70, 12, 1.2], [168, 20, 1.6], [196, 70, 1], [186, 142, 1.3], [30, 96, 1], [140, 160, 1.1], [104, 6, 0.9],
];

/** A little ship orbiting a planet once per session, leaving a trail of progress. */
export function spaceshipFace(): Face {
  let root: SVGSVGElement | null = null;

  function draw(p: number) {
    if (!root) return;
    const done = 1 - clamp01(p);
    // Start at the front of the orbit and go round once; the ship dips behind the planet on the far side.
    const a = Math.PI / 2 + done * Math.PI * 2;
    const x = CX + RX * Math.cos(a);
    const y = CY + RY * Math.sin(a);
    const behind = Math.sin(a) < 0;
    const ship = root.querySelector<SVGGElement>('.ss-ship')!;
    // Heading along the ellipse tangent; smaller when farther away.
    const heading = (Math.atan2(RY * Math.cos(a), -RX * Math.sin(a)) * 180) / Math.PI;
    const scale = 0.75 + 0.25 * Math.sin(a);
    ship.setAttribute('transform', `translate(${x} ${y}) rotate(${heading}) scale(${scale})`);
    root.querySelector(behind ? '.ss-back' : '.ss-front')!.append(ship);
    // The trail path starts at the front of the orbit and runs the same way as the ship.
    // Drawn twice: behind the planet, and again over it for the near half of the orbit.
    root.querySelectorAll<SVGPathElement>('.ss-trail').forEach((trail) => {
      const len = trail.getTotalLength?.() ?? 400;
      trail.style.strokeDasharray = `${len * done} ${len}`;
    });
    setLevel(root, done);
  }

  return {
    id: 'spaceship',
    label: 'Spaceship',
    preview: `<svg viewBox="0 0 48 48" aria-hidden="true"><ellipse cx="24" cy="22" rx="20" ry="8" fill="none" stroke="currentColor" stroke-opacity=".35" stroke-width="1.5" stroke-dasharray="3 3"/><circle cx="24" cy="22" r="9" fill="var(--mode)"/><ellipse cx="24" cy="22" rx="14" ry="3.5" fill="none" stroke="var(--on-accent)" stroke-opacity=".7" stroke-width="1.5"/><path d="M8 26l6-2-2 5Z" fill="currentColor"/></svg>`,
    mount(layer, ctx) {
      const stars = STARS.map(([x, y, r], i) => `<circle class="ss-star" cx="${x}" cy="${y}" r="${r}" style="animation-delay:${i * 0.4}s"/>`).join('');
      layer.insertAdjacentHTML(
        'beforeend',
        `<svg class="spaceship" viewBox="0 0 220 220" aria-hidden="true">
          <defs><clipPath id="ss-near"><rect x="0" y="${CY}" width="220" height="120"/></clipPath></defs>
          ${stars}
          <ellipse class="ss-orbit" cx="${CX}" cy="${CY}" rx="${RX}" ry="${RY}"/>
          <path class="ss-trail" d="M${CX} ${CY + RY}A${RX} ${RY} 0 1 1 ${CX} ${CY - RY}A${RX} ${RY} 0 1 1 ${CX} ${CY + RY}"/>
          <g class="ss-back"></g>
          <g class="ss-planet">
            <circle class="ss-globe" cx="${CX}" cy="${CY}" r="38"/>
            <path class="ss-band" d="M76 72q34 10 68 0M74 90q36 10 72 0"/>
            <ellipse class="ss-ring" cx="${CX}" cy="${CY + 2}" rx="58" ry="12" transform="rotate(-12 ${CX} ${CY})"/>
          </g>
          <g clip-path="url(#ss-near)">
            <ellipse class="ss-orbit" cx="${CX}" cy="${CY}" rx="${RX}" ry="${RY}"/>
            <path class="ss-trail ss-trail-near" d="M${CX} ${CY + RY}A${RX} ${RY} 0 1 1 ${CX} ${CY - RY}A${RX} ${RY} 0 1 1 ${CX} ${CY + RY}"/>
          </g>
          <g class="ss-front"></g>
          <g class="ss-ship">
            <path class="ss-flame" d="M-14 0l-10 -4 3 4 -3 4Z"/>
            <path class="ss-hull" d="M16 0L-8 -8L-12 0L-8 8Z"/>
            <circle class="ss-window" cx="3" cy="0" r="3"/>
          </g>
        </svg>`,
      );
      root = layer.querySelector('svg.spaceship');
      root!.classList.toggle('running', ctx.status === 'running');
      draw(ctx.remainingMs / ctx.durationMs);
    },
    setProgress(p, ctx) {
      root?.classList.toggle('running', ctx.status === 'running');
      draw(p);
    },
    event(e) {
      if (!root || reducedMotion()) return;
      if (e === 'complete') animate(root.querySelector('.ss-globe')!, { opacity: [1, 0.6, 1], duration: 900, ease: 'inOutSine' });
    },
    unmount() {
      root?.remove();
      root = null;
    },
  };
}
