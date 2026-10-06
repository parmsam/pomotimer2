import { test as base, expect, type Page } from '@playwright/test';

/** `test` that fails if the page throws an uncaught error. */
export const test = base.extend<{ noPageErrors: void }>({
  noPageErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await use();
      expect(errors, 'uncaught page errors').toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

export const MIN = 60_000;

/** Loads the app with clean storage (plus optional seeded data) and waits for it to settle. */
export async function open(page: Page, seed?: { data?: unknown; settings?: unknown }) {
  await page.goto('./');
  await page.evaluate((seed) => {
    localStorage.clear();
    if (seed?.data) localStorage.setItem('pomo:v1:data', JSON.stringify(seed.data));
    // The one-time tips and the launch splash are off unless a test asks for them.
    const settings = { shortcutsHintSeen: true, gesturesTipSeen: true, splash: false, ...(seed?.settings as object) };
    localStorage.setItem('pomo:v1:settings', JSON.stringify(settings));
  }, seed);
  await page.reload();
  await expect(page.locator('#time')).not.toBeEmpty();
}

/** Persisted app data, read after the store's save debounce. */
export async function stored(page: Page) {
  await page.waitForTimeout(300);
  return page.evaluate(() => JSON.parse(localStorage.getItem('pomo:v1:data') ?? 'null'));
}

export async function storedSettings(page: Page) {
  await page.waitForTimeout(300);
  return page.evaluate(() => JSON.parse(localStorage.getItem('pomo:v1:settings') ?? 'null'));
}

/** A focus session that is `elapsedMin` into a 25-minute pomodoro. */
export function focusInProgress(elapsedMin: number, extra: Record<string, unknown> = {}) {
  const now = Date.now();
  return {
    timer: {
      mode: 'focus' as string,
      status: 'running' as string,
      endsAt: (now + (25 - elapsedMin) * MIN) as number | null,
      remainingMs: 0,
      cycleCount: 0,
      segmentStart: now - elapsedMin * MIN,
      focusedMs: 0,
      interruptions: { internal: 0, external: 0 },
    },
    history: [],
    tasks: [],
    activeTaskId: null,
    ...extra,
  };
}

/** Clears focus so Space goes to the global shortcut rather than a focused button. */
export const blur = (page: Page) => page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
