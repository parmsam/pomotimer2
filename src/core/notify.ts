export const notificationsSupported = () => 'Notification' in window;

/** Resolves true if notifications are (now) permitted. */
export async function requestNotifications(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  return (await Notification.requestPermission()) === 'granted';
}

/** `sticky` keeps it on screen until dismissed (where the browser supports it). */
export function notify(title: string, body: string, opts: { sticky?: boolean; onClick?: () => void } = {}): Notification | undefined {
  if (!notificationsSupported() || Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, { body, icon: `${import.meta.env.BASE_URL}favicon.svg`, tag: 'pomo', requireInteraction: !!opts.sticky });
    n.onclick = () => {
      window.focus();
      n.close();
      opts.onClick?.();
    };
    return n;
  } catch {
    // Some mobile browsers only allow notifications from a service worker.
  }
}
