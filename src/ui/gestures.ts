import type { Mode } from '../core/types';

const SWIPE_PX = 50;
const HOLD_MS = 600;
const MOVE_TOLERANCE = 12;

/**
 * Touch gestures on the timer: tap to start/pause, swipe left/right to change mode,
 * hold to restart. Vertical movement is left to the browser, so the page still scrolls.
 * They go through the same actions as the buttons, so confirmations still apply.
 */
export function attachGestures(
  el: HTMLElement,
  actions: { toggle(): void; reset(): void; switchTo(mode: Mode): void; currentMode(): Mode; feedback(): void },
) {
  const ORDER: Mode[] = ['focus', 'short', 'long'];
  let start: { x: number; y: number; t: number; id: number } | null = null;
  let holdTimer: number | undefined;
  let held = false;

  el.style.touchAction = 'pan-y';

  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch' || !e.isPrimary) return;
    start = { x: e.clientX, y: e.clientY, t: Date.now(), id: e.pointerId };
    held = false;
    holdTimer = window.setTimeout(() => {
      held = true;
      actions.feedback();
      actions.reset();
    }, HOLD_MS);
  });

  el.addEventListener('pointermove', (e) => {
    if (!start || e.pointerId !== start.id) return;
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > MOVE_TOLERANCE) clearTimeout(holdTimer);
  });

  const end = (e: PointerEvent) => {
    if (!start || e.pointerId !== start.id) return;
    clearTimeout(holdTimer);
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    start = null;
    if (held || e.type === 'pointercancel') return;
    if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.5) {
      const i = ORDER.indexOf(actions.currentMode());
      const next = ORDER[(i + (dx < 0 ? 1 : -1) + ORDER.length) % ORDER.length];
      actions.feedback();
      actions.switchTo(next);
    } else if (Math.hypot(dx, dy) < MOVE_TOLERANCE) {
      actions.toggle();
    }
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}

/**
 * Safari ignores the viewport's maximum-scale and touch-action for pinches (iOS touch,
 * macOS trackpad) but lets us cancel its gesture events. Browser zoom (⌘/Ctrl +/−) is unaffected.
 */
export function blockPinchZoom(target: EventTarget = document) {
  for (const type of ['gesturestart', 'gesturechange']) {
    target.addEventListener(type, (e) => e.preventDefault(), { passive: false });
  }
}
