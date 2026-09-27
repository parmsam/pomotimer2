import type { JSAnimation } from 'animejs';
import { formatTime } from '../core/format';
import { FACES, type Face, type FaceContext, type FaceEvent, type FaceId } from '../faces';
import { rollChar, tweenProgress } from '../fx/anims';

export interface TimerView {
  /** Per-frame update while running. */
  render(remainingMs: number, durationMs: number): void;
  /** Animated jump, e.g. on reset or mode change. */
  refill(remainingMs: number, durationMs: number): void;
  setFace(id: FaceId): void;
  /** Let the face react to a moment (start, complete, …). */
  event(e: FaceEvent): void;
}

/**
 * Owns the clock digits (real, accessible text) and the progress value, and delegates
 * the artwork to the active face.
 */
export function createTimerView(root: HTMLElement, opts: { rollingDigits: () => boolean; context: () => FaceContext }): TimerView {
  const layer = root.querySelector<HTMLElement>('.face-layer')!;
  const timeEl = root.querySelector<HTMLElement>('#time')!;

  let face: Face | null = null;
  let shown = '';
  let progress = 1;
  let tween: JSAnimation | null = null;

  const setProgress = (p: number) => {
    p = Math.min(1, Math.max(0, p)); // adding time can push remaining past the planned length
    progress = p;
    face?.setProgress(p, opts.context());
  };

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
          if (opts.rollingDigits()) rollChar(span, direction);
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
      const target = duration > 0 ? Math.min(1, remaining / duration) : 0;
      setTime(formatTime(remaining), target >= progress ? -1 : 1);
      const t = tweenProgress(progress, target, setProgress);
      tween = t;
      t?.then(() => {
        if (tween === t) tween = null;
      });
    },
    setFace(id) {
      if (face?.id === id) return;
      face?.unmount();
      face = (FACES[id] ?? FACES.ring)();
      root.dataset.face = face.id;
      face.mount(layer, opts.context());
      face.setProgress(progress, opts.context());
    },
    event(e) {
      face?.event?.(e, opts.context());
    },
  };
}
