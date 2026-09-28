import { animate } from 'animejs';
import { reducedMotion } from '../fx/anims';
import { clamp01, setLevel } from './common';
import type { Face } from './types';

// A tilted orbit (ellipse) around a ringed planet, seen at an angle.
const CX = 110;
const CY = 82;
const RX = 94;
const RY = 42; // tall enough that the orbit clears the planet top and bottom
const PR = 28; // planet radius
const TILT = -14; // ring tilt
// Surface features that drift across the globe as it turns (drawn twice for a seamless loop).
const SPOTS: [number, number, number, number][] = [
  [90, 72, 5, 3], [118, 92, 7, 4], [104, 100, 4, 2.5], [130, 68, 4, 2.5], [97, 88, 3, 2], [124, 78, 2.5, 1.6],
];
const STARS: [number, number, number][] = [
  [20, 24, 1.4], [46, 150, 1], [70, 12, 1.2], [168, 20, 1.6], [196, 70, 1], [186, 142, 1.3], [30, 96, 1], [140, 160, 1.1], [104, 6, 0.9],
];

/** A little ship orbiting a planet once per session, leaving a trail of progress. */
export function spaceshipFace(): Face {
  let root: SVGSVGElement | null = null;

  let done = 0;
  let lapping = false; // the celebration lap owns the ship until it's back

  function placeShip(a: number) {
    const ship = root!.querySelector<SVGGElement>('.ss-ship')!;
    const x = CX + RX * Math.cos(a);
    const y = CY + RY * Math.sin(a);
    // Heading along the ellipse tangent; smaller when farther away.
    const heading = (Math.atan2(RY * Math.cos(a), -RX * Math.sin(a)) * 180) / Math.PI;
    const scale = 0.75 + 0.25 * Math.sin(a);
    ship.setAttribute('transform', `translate(${x} ${y}) rotate(${heading}) scale(${scale})`);
    // The ship dips behind the planet on the far side.
    root!.querySelector(Math.sin(a) < 0 ? '.ss-back' : '.ss-front')!.append(ship);
  }

  function draw(p: number) {
    if (!root) return;
    done = 1 - clamp01(p);
    // Start at the front of the orbit and go round once.
    if (!lapping) placeShip(Math.PI / 2 + done * Math.PI * 2);
    // The trail path starts at the front of the orbit and runs the same way as the ship.
    const trail = root.querySelector<SVGPathElement>('.ss-trail')!;
    const len = trail.getTotalLength?.() ?? 400;
    trail.style.strokeDasharray = `${len * done} ${len}`;
    setLevel(root, done);
  }

  return {
    id: 'spaceship',
    label: 'Spaceship',
    preview: `<svg viewBox="0 0 48 48" aria-hidden="true"><ellipse cx="24" cy="22" rx="20" ry="8" fill="none" stroke="currentColor" stroke-opacity=".35" stroke-width="1.5" stroke-dasharray="3 3"/><circle cx="24" cy="22" r="9" fill="var(--mode)"/><ellipse cx="24" cy="22" rx="14" ry="3.5" fill="none" stroke="var(--on-accent)" stroke-opacity=".7" stroke-width="1.5"/><path d="M8 26l6-2-2 5Z" fill="currentColor"/></svg>`,
    mount(layer, ctx) {
      const spots = [0, 2 * PR]
        .map((dx) => SPOTS.map(([x, y, rx, ry]) => `<ellipse cx="${x + dx}" cy="${y}" rx="${rx}" ry="${ry}"/>`).join(''))
        .join('');
      const stars = STARS.map(([x, y, r], i) => `<circle class="ss-star" cx="${x}" cy="${y}" r="${r}" style="animation-delay:${i * 0.4}s"/>`).join('');
      layer.insertAdjacentHTML(
        'beforeend',
        `<svg class="spaceship" viewBox="0 0 220 220" aria-hidden="true">
          <defs>
            <clipPath id="ss-globe-clip"><circle cx="${CX}" cy="${CY}" r="${PR}"/></clipPath>
            <!-- The near half of the ring, in the ring's own (tilted) frame -->
            <clipPath id="ss-ring-near"><rect x="${CX - 70}" y="${CY}" width="140" height="40" transform="rotate(${TILT} ${CX} ${CY})"/></clipPath>
          </defs>
          ${stars}
          <g class="ss-comet"><path class="ss-comet-tail" d="M0 0l-30 -9"/><circle class="ss-comet-head" r="1.6"/></g>
          <ellipse class="ss-orbit" cx="${CX}" cy="${CY}" rx="${RX}" ry="${RY}"/>
          <path class="ss-trail" d="M${CX} ${CY + RY}A${RX} ${RY} 0 1 1 ${CX} ${CY - RY}A${RX} ${RY} 0 1 1 ${CX} ${CY + RY}"/>
          <g class="ss-back"></g>
          <g class="ss-planet">
            <ellipse class="ss-ring" cx="${CX}" cy="${CY}" rx="${PR + 20}" ry="10" transform="rotate(${TILT} ${CX} ${CY})"/>
            <circle class="ss-globe" cx="${CX}" cy="${CY}" r="${PR}"/>
            <g clip-path="url(#ss-globe-clip)">
              <g class="ss-spots">${spots}</g>
              <path class="ss-shade" fill-rule="evenodd" d="M${CX - PR} ${CY - PR}h${2 * PR}v${2 * PR}h${-2 * PR}ZM${CX - 8 - PR} ${CY - 6}a${PR} ${PR} 0 1 0 ${2 * PR} 0a${PR} ${PR} 0 1 0 ${-2 * PR} 0Z"/>
            </g>
            <path class="ss-band" clip-path="url(#ss-globe-clip)" d="M${CX - PR + 4} ${CY - 8}q${PR - 4} 8 ${2 * PR - 8} 0M${CX - PR + 2} ${CY + 8}q${PR - 2} 8 ${2 * PR - 4} 0"/>
            <ellipse class="ss-ring" cx="${CX}" cy="${CY}" rx="${PR + 20}" ry="10" transform="rotate(${TILT} ${CX} ${CY})" clip-path="url(#ss-ring-near)"/>
          </g>
          <g class="ss-front"></g>
          <g class="ss-ship"><g class="ss-bob">
            <g class="ss-boost"><path class="ss-flame" d="M-12 0l-12 -4 3 4 -3 4Z"/></g>
            <path class="ss-hull" d="M16 0L-8 -8L-12 0L-8 8Z"/>
            <circle class="ss-window" cx="3" cy="0" r="3"/>
          </g></g>
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
    event(e, ctx) {
      if (!root) return;
      root.classList.toggle('running', ctx.status === 'running');
      if (reducedMotion()) return;
      if (e === 'start') animate(root.querySelector('.ss-boost')!, { scaleX: [1, 1.8, 1], duration: 700, ease: 'out(2)' });
      if (e === 'complete') {
        animate(root.querySelector('.ss-globe')!, { opacity: [1, 0.6, 1], duration: 900, ease: 'inOutSine' });
        // A victory lap at full throttle, ending back at the front of the orbit.
        lapping = true;
        const lap = { t: 0 };
        animate(lap, {
          t: 1,
          duration: 1400,
          ease: 'inOut(3)',
          onUpdate: () => root && placeShip(Math.PI / 2 + lap.t * Math.PI * 2),
          onComplete: () => {
            lapping = false;
            if (root) placeShip(Math.PI / 2 + done * Math.PI * 2);
          },
        });
        animate(root.querySelector('.ss-boost')!, { scaleX: [1, 2.2, 1], duration: 1400, ease: 'inOutSine' });
      }
    },
    unmount() {
      root?.remove();
      root = null;
      lapping = false;
    },
  };
}
