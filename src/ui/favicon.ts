/**
 * Draws session progress into the tab icon while a session runs, so it's visible
 * among other tabs. Falls back to the static tomato when idle.
 */
export function createProgressFavicon() {
  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')!;
  const original = link.href;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  let last = '';

  return {
    /** `remaining` is the share left (1 → 0); null restores the normal icon. */
    update(remaining: number | null) {
      if (!ctx) return;
      if (remaining === null) {
        if (last !== 'idle') {
          link.type = 'image/svg+xml';
          link.href = original;
          last = 'idle';
        }
        return;
      }
      const css = getComputedStyle(document.documentElement);
      const color = css.getPropertyValue('--mode').trim() || '#ff8e7f';
      const key = `${Math.round(remaining * 60)}:${color}`; // redraw only on visible change
      if (key === last) return;
      last = key;
      ctx.clearRect(0, 0, 64, 64);
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(128,128,128,.35)';
      ctx.beginPath();
      ctx.arc(32, 32, 25, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.arc(32, 32, 25, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * remaining);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(32, 32, 9, 0, Math.PI * 2);
      ctx.fill();
      link.type = 'image/png';
      link.href = canvas.toDataURL('image/png');
    },
  };
}
