/** Full-screen toggle (Fullscreen API). Hidden where unsupported, e.g. iPhone Safari. */
type Doc = Document & { webkitFullscreenEnabled?: boolean; webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> };
type El = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };

const doc = document as Doc;
export const fullscreenSupported = () => !!(doc.fullscreenEnabled || doc.webkitFullscreenEnabled);
const current = () => doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;

const EXPAND = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
const COLLAPSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>';

export function createFullscreenButton(btn: HTMLButtonElement) {
  if (!fullscreenSupported()) {
    btn.hidden = true;
    return { toggle() {} };
  }

  function render() {
    const on = !!current();
    btn.innerHTML = on ? COLLAPSE : EXPAND;
    const label = on ? 'Exit full screen' : 'Full screen';
    btn.setAttribute('aria-label', label);
    btn.title = label;
    btn.setAttribute('aria-pressed', String(on));
  }

  async function toggle() {
    try {
      if (current()) await (doc.exitFullscreen?.() ?? doc.webkitExitFullscreen?.());
      else {
        const root = document.documentElement as El;
        await (root.requestFullscreen?.({ navigationUI: 'hide' }) ?? root.webkitRequestFullscreen?.());
      }
    } catch {
      // Refused (e.g. not from a user gesture); nothing to do.
    }
  }

  btn.addEventListener('click', () => void toggle());
  document.addEventListener('fullscreenchange', render);
  document.addEventListener('webkitfullscreenchange', render);
  render();
  return { toggle };
}
