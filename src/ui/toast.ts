import { animate } from 'animejs';
import { reducedMotion } from '../fx/anims';

let current: { el: HTMLElement; timer: number } | null = null;

/** Brief message pinned to the bottom of the screen. Replaces any toast already showing. */
export function toast(message: string, opts: { duration?: number; onDismiss?: () => void; action?: { label: string; run: () => void } } = {}) {
  dismiss();
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  const text = document.createElement('span');
  text.textContent = message;
  el.append(text);
  if (opts.action) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'toast-action';
    btn.textContent = opts.action.label;
    btn.addEventListener('click', () => {
      opts.action!.run();
      dismiss();
    });
    el.append(btn);
  }
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'toast-close';
  close.setAttribute('aria-label', 'Dismiss');
  close.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';
  close.addEventListener('click', () => dismiss());
  el.append(close);
  document.body.append(el);

  const timer = window.setTimeout(() => dismiss(), opts.duration ?? 2600);
  current = { el, timer };
  const onDismiss = opts.onDismiss;
  el.addEventListener('toast:dismiss', () => onDismiss?.(), { once: true });
  if (!reducedMotion()) animate(el, { y: [24, 0], opacity: [0, 1], duration: 450, ease: 'out(3)' });
}

export function dismiss() {
  if (!current) return;
  const { el, timer } = current;
  current = null;
  clearTimeout(timer);
  el.dispatchEvent(new Event('toast:dismiss'));
  if (reducedMotion()) return el.remove();
  animate(el, { y: 16, opacity: 0, duration: 220, ease: 'in(2)', onComplete: () => el.remove() });
}
