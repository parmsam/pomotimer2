export type Buzz = 'tap' | 'success' | 'warn';

const PATTERNS: Record<Buzz, number[]> = {
  tap: [12],
  success: [30, 60, 30, 60, 90],
  warn: [20, 50, 20],
};

export const isTouchDevice = () => window.matchMedia('(hover: none) and (pointer: coarse)').matches;

let switchLabel: HTMLLabelElement | null = null;

/**
 * iOS Safari has no navigator.vibrate(). Since iOS 18, toggling an
 * <input type="checkbox" switch> plays the system switch haptic, so we keep a hidden
 * one and flip it. It only fires inside a real user gesture (a tap), which is why
 * session-end alerts on iOS stay sound + notification. Isolated here so it's easy
 * to remove if Apple changes the behavior.
 */
function iosSwitchTick() {
  if (!switchLabel) {
    switchLabel = document.createElement('label');
    switchLabel.setAttribute('aria-hidden', 'true');
    switchLabel.className = 'haptic-switch';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.tabIndex = -1;
    switchLabel.append(input);
    document.body.append(switchLabel);
  }
  switchLabel.click();
}

/** A short vibration. No-op where unsupported (e.g. desktop). */
export function buzz(kind: Buzz): void {
  try {
    if ('vibrate' in navigator) navigator.vibrate(PATTERNS[kind]);
    else if (isTouchDevice()) {
      iosSwitchTick();
      // One switch tick is a single pulse; add a second for "success".
      if (kind === 'success') setTimeout(iosSwitchTick, 120);
    }
  } catch {
    // Some browsers throw without user activation; haptics are best-effort.
  }
}
