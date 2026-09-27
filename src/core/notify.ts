export const notificationsSupported = () => 'Notification' in window;

/** Resolves true if notifications are (now) permitted. */
export async function requestNotifications(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  return (await Notification.requestPermission()) === 'granted';
}

export function notify(title: string, body: string): void {
  if (!notificationsSupported() || Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, { body, icon: `${import.meta.env.BASE_URL}favicon.svg`, tag: 'pomo' });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    // Some mobile browsers only allow notifications from a service worker.
  }
}
