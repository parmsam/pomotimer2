import type { JSAnimation } from 'animejs';
import { rollChar, tweenProgress } from '../fx/anims';

const RADIUS = 100;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function formatTime(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export interface TimerView {
  /** Per-frame update while running. */
  render(remainingMs: number, durationMs: number): void;
  /** Animated jump, e.g. on reset or mode change. */
  refill(remainingMs: number, durationMs: number): void;
}

export function createTimerView(root: HTMLElement): TimerView {
  const progressEl = root.querySelector<SVGCircleElement>('.ring-progress')!;
  const headEl = root.querySelector<SVGGElement>('.ring-head-wrap')!;
  const timeEl = root.querySelector<HTMLElement>('#time')!;

  progressEl.style.strokeDasharray = String(CIRCUMFERENCE);

  let shown = '';
  let progress = 1;
  let tween: JSAnimation | null = null;

  function setProgress(p: number) {
    progress = p;
    progressEl.style.strokeDashoffset = String(CIRCUMFERENCE * (1 - p));
    // SVG transform attribute (not CSS) so the pivot is in viewBox units in every browser.
    headEl.setAttribute('transform', `rotate(${p * 360} 110 110)`);
    headEl.style.opacity = p > 0.002 ? '1' : '0';
  }

  function setTime(text: string, direction: 1 | -1) {
    if (text === shown) return;
    if (text.length !== shown.length) {
      timeEl.replaceChildren(
        ...[...text].map((c) => {
          const span = document.createElement('span');
          span.className = c === ':' ? 'ch colon' : 'ch';
          span.textContent = c;
          return span;
        }),
      );
    } else {
      [...text].forEach((c, i) => {
        if (c !== shown[i]) {
          const span = timeEl.children[i] as HTMLElement;
          span.textContent = c;
          rollChar(span, direction);
        }
      });
    }
    shown = text;
  }

  return {
    render(remaining, duration) {
      if (tween) return; // let a refill finish before per-frame updates resume
      setProgress(duration > 0 ? remaining / duration : 0);
      setTime(formatTime(remaining), 1);
    },
    refill(remaining, duration) {
      tween?.cancel();
      const target = duration > 0 ? remaining / duration : 0;
      setTime(formatTime(remaining), target >= progress ? -1 : 1);
      const t = tweenProgress(progress, target, setProgress);
      tween = t;
      t?.then(() => {
        if (tween === t) tween = null;
      });
    },
  };
}
