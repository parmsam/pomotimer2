const requested = new Set<string>();

/** Loads a Google Font once, on demand (only faces that use it pay for it). */
export function loadFont(family: string) {
  if (requested.has(family)) return;
  requested.add(family);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}&display=swap`;
  document.head.append(link);
}

export const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Exposes a face's fill level (0–100) for tests and styling. */
export const setLevel = (el: Element | null, level: number) => el?.setAttribute('data-level', String(Math.round(clamp01(level) * 100)));
