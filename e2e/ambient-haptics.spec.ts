import { expect, focusInProgress, open, test } from './helpers';

const MIN = 60_000;
const ambient = (page: import('@playwright/test').Page) => page.locator('body');

test.describe('ambient sound', () => {
  test('plays only while a focus session runs, and stops on pause', async ({ page }) => {
    await open(page, { settings: { ambient: 'rain' } });
    await expect(ambient(page)).toHaveAttribute('data-ambient', 'off');
    await page.locator('#toggle').click();
    await expect(ambient(page)).toHaveAttribute('data-ambient', 'rain');
    await page.locator('#toggle').click();
    await expect(ambient(page)).toHaveAttribute('data-ambient', 'off');
  });

  test('stays off on breaks unless enabled, and mute silences it', async ({ page }) => {
    const seed = focusInProgress(0);
    seed.timer = { ...seed.timer, mode: 'short', endsAt: Date.now() + 4 * MIN };
    await open(page, { data: seed, settings: { ambient: 'brown' } });
    await expect(ambient(page)).toHaveAttribute('data-ambient', 'off');

    await open(page, { data: { ...seed, timer: { ...seed.timer, endsAt: Date.now() + 4 * MIN } }, settings: { ambient: 'brown', ambientOnBreaks: true } });
    await expect(ambient(page)).toHaveAttribute('data-ambient', 'brown');

    await page.locator('#settings-open').click();
    await page.locator('label[for="set-muted"]').click();
    await expect(ambient(page)).toHaveAttribute('data-ambient', 'off');
  });

  test('choosing a sound in settings plays a short preview', async ({ page }) => {
    await open(page);
    await page.locator('#settings-open').click();
    await page.locator('#set-ambient').selectOption('vinyl');
    await expect(ambient(page)).toHaveAttribute('data-ambient', 'vinyl');
    await expect(ambient(page)).toHaveAttribute('data-ambient', 'off', { timeout: 6000 });
  });
});

test.describe('haptics', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch devices only');

  test('vibrates on start and when a session ends', async ({ page }) => {
    await page.addInitScript(() => {
      const calls: number[][] = [];
      Object.defineProperty(Navigator.prototype, 'vibrate', { configurable: true, value: (p: number[]) => (calls.push(p), true) });
      (window as unknown as { vibrations: number[][] }).vibrations = calls;
    });
    const seed = focusInProgress(0);
    seed.timer = { ...seed.timer, status: 'paused', endsAt: null, remainingMs: 1500 };
    await open(page, { data: seed, settings: { mobileTipSeen: true } });
    await page.locator('#toggle').click();
    const vib = () => page.evaluate(() => (window as unknown as { vibrations: number[][] }).vibrations);
    await expect.poll(vib).toEqual([[12]]);
    await expect.poll(vib, { timeout: 5000 }).toEqual([[12], [30, 60, 30, 60, 90]]);
  });

  test('iOS (no navigator.vibrate): a real tap lands on a hidden switch over the button', async ({ page }) => {
    await page.addInitScript(() => {
      delete (Navigator.prototype as unknown as { vibrate?: unknown }).vibrate;
    });
    await open(page, { settings: { mobileTipSeen: true } });
    expect(await page.evaluate(() => 'vibrate' in navigator)).toBe(false);
    const toggle = page.locator('#toggle');
    const sw = toggle.locator('[data-haptic-trigger] input[switch]');
    await toggle.tap();
    await expect(sw).toBeChecked();
    // The button's own handler still runs, exactly once.
    await expect(toggle).toHaveAttribute('aria-label', /^Pause/);
    await toggle.tap();
    await expect(sw).not.toBeChecked();
    await expect(toggle).toHaveAttribute('aria-label', /^Resume/);
    for (const id of ['#reset', '#skip']) await expect(page.locator(`${id} [data-haptic-trigger] input[switch]`)).toHaveCount(1);
    await expect(page.locator('.modes [data-haptic-trigger] input[switch]')).toHaveCount(3);
  });

  test('iOS: turning vibration off silences the switches', async ({ page }) => {
    await page.addInitScript(() => {
      delete (Navigator.prototype as unknown as { vibrate?: unknown }).vibrate;
    });
    await open(page, { settings: { haptics: false, mobileTipSeen: true } });
    const toggle = page.locator('#toggle');
    await toggle.tap();
    await expect(toggle).toHaveAttribute('aria-label', /^Pause/);
    await expect(toggle.locator('[data-haptic-trigger] input[switch]')).not.toBeChecked();
  });

  test('can be turned off', async ({ page }) => {
    await page.addInitScript(() => {
      const calls: number[][] = [];
      Object.defineProperty(Navigator.prototype, 'vibrate', { configurable: true, value: (p: number[]) => (calls.push(p), true) });
      (window as unknown as { vibrations: number[][] }).vibrations = calls;
    });
    await open(page, { settings: { haptics: false, mobileTipSeen: true } });
    await page.locator('#toggle').click();
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => (window as unknown as { vibrations: number[][] }).vibrations)).toEqual([]);
  });
});

test('the vibration setting only appears on touch devices', async ({ page, isMobile }) => {
  await open(page);
  await page.locator('#settings-open').click();
  await expect(page.locator('#set-haptics')).toHaveCount(isMobile ? 1 : 0);
});
