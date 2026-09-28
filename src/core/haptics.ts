export type Buzz = 'tap' | 'success' | 'warn';

const PATTERNS: Record<Buzz, number[]> = {
  tap: [12],
  success: [30, 60, 30, 60, 90],
  warn: [20, 50, 20],
};

export const isTouchDevice = () => window.matchMedia('(hover: none) and (pointer: coarse)').matches;

export const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** iOS Safari (and any touch browser without navigator.vibrate) gets haptics from switches instead. */
const needsSwitchHaptics = () => !('vibrate' in navigator) && (isIos() || isTouchDevice());

/** A short vibration where navigator.vibrate() exists (Android). No-op elsewhere. */
export function buzz(kind: Buzz): void {
  try {
    if ('vibrate' in navigator) navigator.vibrate(PATTERNS[kind]);
  } catch {
    // Some browsers throw without user activation; haptics are best-effort.
  }
}

let switchesEnabled = true;

/**
 * iOS has no navigator.vibrate(), but since iOS 18 toggling an <input type="checkbox" switch>
 * plays the system haptic. It only does so when a real tap lands on the switch's label:
 * clicking it from script is silent. So we lay an invisible label over the element and let
 * the tap hit it. The click still bubbles up to the element's own handlers.
 * Isolated here so it's easy to remove if Apple changes the behavior.
 */
export function hapticTrigger(el: HTMLElement): void {
  if (!needsSwitchHaptics() || el.querySelector(':scope > [data-haptic-trigger]')) return;

  const label = document.createElement('label');
  label.setAttribute('data-haptic-trigger', '');
  label.setAttribute('aria-hidden', 'true');
  Object.assign(label.style, { position: 'absolute', inset: '0', borderRadius: 'inherit', touchAction: 'manipulation' });
  label.style.setProperty('-webkit-tap-highlight-color', 'transparent');

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  input.tabIndex = -1;
  input.disabled = !switchesEnabled;
  // Never under the finger: WebKit treats a touchstart on the switch as handled, which cancels scrolling.
  Object.assign(input.style, { position: 'absolute', width: '1px', height: '1px', margin: '0', visibility: 'hidden' });
  // The label re-dispatches its click to the switch; keep that copy from reaching the element's handlers twice.
  input.addEventListener('click', (e) => e.stopPropagation());

  label.append(input);
  if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
  el.append(label);
}

/** Follows the Vibration setting: a disabled switch doesn't toggle, so it stays silent. */
export function setHapticTriggersEnabled(on: boolean): void {
  switchesEnabled = on;
  document.querySelectorAll<HTMLInputElement>('[data-haptic-trigger] > input').forEach((s) => (s.disabled = !on));
}
