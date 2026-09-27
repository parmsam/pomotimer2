import type { Face } from './types';

const R = 100;
const C = 2 * Math.PI * R;

/** The default: a glowing progress ring with a playhead. */
export function ringFace(): Face {
  let progressEl: SVGCircleElement | null = null;
  let headEl: SVGGElement | null = null;
  let svg: SVGSVGElement | null = null;

  return {
    id: 'ring',
    label: 'Ring',
    preview: `<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="18" fill="none" stroke="currentColor" stroke-opacity=".25" stroke-width="4"/><path d="M24 6a18 18 0 1 1-17.1 23.6" fill="none" stroke="var(--mode)" stroke-width="4" stroke-linecap="round"/></svg>`,
    mount(layer) {
      layer.innerHTML = `
        <svg class="ring" viewBox="0 0 220 220" aria-hidden="true">
          <circle class="ring-track" cx="110" cy="110" r="${R}" />
          <circle class="ring-progress" cx="110" cy="110" r="${R}" transform="rotate(-90 110 110)" />
          <g class="ring-head-wrap"><circle class="ring-head" cx="110" cy="10" r="6" /></g>
        </svg>`;
      svg = layer.querySelector('svg');
      progressEl = layer.querySelector('.ring-progress');
      headEl = layer.querySelector('.ring-head-wrap');
      progressEl!.style.strokeDasharray = String(C);
    },
    setProgress(p) {
      if (!progressEl || !headEl) return;
      progressEl.style.strokeDashoffset = String(C * (1 - p));
      // SVG transform attribute (not CSS) so the pivot is in viewBox units in every browser.
      headEl.setAttribute('transform', `rotate(${p * 360} 110 110)`);
      headEl.style.opacity = p > 0.002 ? '1' : '0';
    },
    unmount() {
      svg?.remove();
      svg = progressEl = headEl = null;
    },
  };
}
