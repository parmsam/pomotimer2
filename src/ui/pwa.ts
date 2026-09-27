import { registerSW } from 'virtual:pwa-register';
import { toast } from './toast';

/**
 * Registers the service worker (offline + installable). New versions wait for the user:
 * reloading on its own could cut into a running session.
 */
export function setupPwa(isBusy: () => boolean) {
  if (!('serviceWorker' in navigator)) return;
  const updateSW = registerSW({
    onNeedRefresh() {
      toast(isBusy() ? 'A new version is ready. Reload when your session ends' : 'A new version of pomo is available', {
        duration: 60_000,
        action: { label: 'Reload', run: () => void updateSW(true) },
      });
    },
    onOfflineReady() {
      toast('pomo now works offline', { duration: 4000 });
    },
  });
}
