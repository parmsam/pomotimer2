import { expect, open, storedSettings, test } from './helpers';

test.describe('silent mode (Audio Session API)', () => {
  test('where supported, the alarm switches to a playback session and then hands it back', async ({ page }) => {
    await page.addInitScript(() => {
      const log: string[] = [];
      let type = 'auto';
      Object.defineProperty(navigator, 'audioSession', {
        value: {
          get type() {
            return type;
          },
          set type(v: string) {
            type = v;
            log.push(v);
          },
        },
      });
      (window as unknown as { sessionLog: string[] }).sessionLog = log;
    });
    await open(page);
    await page.locator('#settings-open').click();
    const toggle = page.locator('#set-alarmIgnoresSilent');
    await expect(toggle).toBeChecked();
    await page.getByRole('button', { name: 'Test' }).click();
    const log = () => page.evaluate(() => (window as unknown as { sessionLog: string[] }).sessionLog);
    expect(await log()).toEqual(['playback']);
    await expect.poll(log, { timeout: 5000 }).toEqual(['playback', 'auto']);

    // Turned off: the session is left alone.
    await page.locator('label[for="set-alarmIgnoresSilent"]').click();
    await page.getByRole('button', { name: 'Test' }).click();
    await page.waitForTimeout(300);
    expect(await log()).toEqual(['playback', 'auto']);
  });

  // Support varies by platform (Apple WebKit has it; Linux WebKit in CI doesn't), so
  // assert consistency with whatever this browser reports.
  test('the setting shows only where the browser supports it', async ({ page }) => {
    await open(page);
    const supported = await page.evaluate(() => 'audioSession' in navigator);
    await page.locator('#settings-open').click();
    await expect(page.locator('#set-alarmIgnoresSilent')).toHaveCount(supported ? 1 : 0);
  });
});

test('phones get a one-time tip about volume, silent mode and keeping the tab open', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch devices only');
  await open(page);
  await page.locator('#toggle').click();
  const tip = page.getByRole('status').filter({ hasText: 'On phones' });
  await expect(tip).toContainText('silent switch');
  await expect(tip).toContainText('Add to Home Screen');
  expect((await storedSettings(page)).mobileTipSeen).toBe(true);
  await tip.locator('.toast-close').click();
  await page.locator('#toggle').click();
  await page.locator('#toggle').click();
  await page.waitForTimeout(400);
  await expect(tip).toHaveCount(0);
});

test.describe('ambient sound and the audio session (Safari)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const log: string[] = [];
      let type = 'auto';
      Object.defineProperty(navigator, 'audioSession', {
        configurable: true,
        value: {
          get type() {
            return type;
          },
          set type(v: string) {
            if (v !== type) log.push(v);
            type = v;
          },
        },
      });
      (window as unknown as { sessionLog: string[] }).sessionLog = log;
    });
  });
  const log = (page: import('@playwright/test').Page) => page.evaluate(() => (window as unknown as { sessionLog: string[] }).sessionLog);

  test('plays through the silent switch while running and hands the session back on pause', async ({ page }) => {
    await open(page, { settings: { ambient: 'rain', mobileTipSeen: true } });
    await page.locator('#toggle').click();
    await expect.poll(() => log(page)).toEqual(['playback']);
    await page.locator('#toggle').click();
    await expect.poll(() => log(page)).toEqual(['playback', 'auto']);
  });

  test('an alarm finishing does not cut off ambient sound that is still playing', async ({ page }) => {
    await open(page, { settings: { ambient: 'rain', mobileTipSeen: true } });
    await page.locator('#toggle').click(); // ambient on → playback
    await page.locator('#settings-open').click();
    await page.getByRole('button', { name: 'Test' }).click(); // alarm rings, then releases its hold
    await page.waitForTimeout(3500);
    expect(await page.evaluate(() => (navigator as unknown as { audioSession: { type: string } }).audioSession.type)).toBe('playback');
  });
});
