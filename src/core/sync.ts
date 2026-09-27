import { loadAppData, loadSettings } from './storage';
import type { Store } from './store';
import type { AppData, Settings } from './types';

/**
 * Keeps several open tabs in step. `storage` events fire only in the *other* tabs, and
 * writing back an identical value doesn't fire again, so this can't ping-pong.
 */
export function syncAcrossTabs(settings: Store<Settings>, data: Store<AppData>): void {
  window.addEventListener('storage', (e) => {
    if (e.storageArea !== localStorage) return;
    if (e.key === 'pomo:v1:settings') settings.set(loadSettings());
    else if (e.key === 'pomo:v1:data') data.set(loadAppData(settings.get()));
    else if (e.key === null) {
      // localStorage.clear() in another tab (e.g. "Reset everything").
      settings.set(loadSettings());
      data.set(loadAppData(settings.get()));
    }
  });
}

/**
 * Runs `fn` in only one tab when several reach the same moment (e.g. a session ending
 * everywhere at once), so the alarm doesn't ring twice. Falls back to always running.
 */
export function onceAcrossTabs(name: string, fn: () => void, holdMs = 4000): void {
  const locks = (navigator as Navigator & { locks?: LockManager }).locks;
  if (!locks) return fn();
  void locks.request(name, { ifAvailable: true }, async (lock) => {
    if (!lock) return; // another tab is handling it
    fn();
    await new Promise((r) => setTimeout(r, holdMs));
  });
}
