/**
 * The launch splash. Its markup and styles are inline in index.html so it paints before
 * the bundle loads, and an inline script there hides it when the setting is off.
 * This module just lifts it once the app is ready.
 */

/** Shortest time the splash stays up, counted from navigation start. */
export const SPLASH_MIN_MS = 1100;
/** Fallback in case `transitionend` never fires (e.g. a hidden tab). */
const FADE_MS = 600;

/**
 * Fades the splash out after it has been up for `minMs`, or on the first tap or key press
 * (which is swallowed so it doesn't also start the timer). Calls `onLift` as the fade starts,
 * or straight away when there's no splash.
 */
export function liftSplash(onLift: () => void, { minMs = SPLASH_MIN_MS, elapsed = performance.now() } = {}): void {
  const el = document.getElementById('splash');
  if (!el || document.documentElement.classList.contains('no-splash')) {
    el?.remove();
    onLift();
    return;
  }

  let lifted = false;
  const lift = () => {
    if (lifted) return;
    lifted = true;
    removeEventListener('pointerdown', onInput, true);
    removeEventListener('keydown', onInput, true);
    onLift();
    el.classList.add('out');
    el.addEventListener('transitionend', () => el.remove(), { once: true });
    setTimeout(() => el.remove(), FADE_MS);
  };
  const onInput = (e: Event) => {
    if (e.type === 'keydown') {
      e.preventDefault();
      e.stopPropagation();
    }
    lift();
  };
  addEventListener('pointerdown', onInput, true);
  addEventListener('keydown', onInput, true);
  setTimeout(lift, Math.max(0, minMs - elapsed));
}
