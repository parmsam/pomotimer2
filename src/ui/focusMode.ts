import type { Store } from '../core/store';
import type { AppData, Settings } from '../core/types';

export interface FocusMode {
  toggle(): void;
  exit(): void;
  isOn(): boolean;
}

/**
 * Hides everything but the timer and its controls. Optionally turns on by itself when
 * a focus session starts, and off again when the session ends.
 */
export function createFocusMode(data: Store<AppData>, settings: Store<Settings>, onChange: () => void): FocusMode {
  const exitBtn = document.getElementById('focus-exit')!;
  const isOn = () => document.body.classList.contains('focus-mode');

  function set(on: boolean) {
    if (on === isOn()) return;
    document.body.classList.toggle('focus-mode', on);
    exitBtn.hidden = !on;
    document.getElementById('live')!.textContent = on ? 'Focus mode on. Press F or Escape to exit.' : 'Focus mode off.';
    onChange();
  }

  exitBtn.addEventListener('click', () => set(false));

  data.subscribe((d, prev) => {
    if (!settings.get().focusModeOnStart) return;
    const t = d.timer;
    const p = prev.timer;
    if (t.mode === 'focus' && t.status === 'running' && p.status !== 'running') set(true);
    else if (t.mode !== p.mode && t.mode !== 'focus') set(false);
  });

  return { toggle: () => set(!isOn()), exit: () => set(false), isOn };
}
