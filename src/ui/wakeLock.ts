/** Keeps the screen on while a session runs (Screen Wake Lock API). No-op where unsupported. */
export const wakeLockSupported = () => 'wakeLock' in navigator;

export function createWakeLock() {
  let sentinel: WakeLockSentinel | null = null;
  let wanted = false;

  async function acquire() {
    if (!wakeLockSupported() || sentinel || document.hidden) return;
    try {
      sentinel = await navigator.wakeLock.request('screen');
      sentinel.addEventListener('release', () => (sentinel = null));
      document.documentElement.dataset.wakeLock = 'on';
    } catch {
      // Denied (e.g. low battery or not visible); try again next time.
    }
  }

  function release() {
    void sentinel?.release();
    sentinel = null;
    delete document.documentElement.dataset.wakeLock;
  }

  // The browser drops the lock when the page is hidden; take it back on return.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && wanted) void acquire();
  });

  return {
    set(on: boolean) {
      wanted = on;
      if (on) void acquire();
      else release();
    },
  };
}
