import { expect, focusInProgress, open, storedSettings, test } from './helpers';

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
    // The bell rings ~4s before the session is handed back; allow slow CI runners plenty of time.
    await expect.poll(log, { timeout: 10_000 }).toEqual(['playback', 'auto']);

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
    await expect.poll(() => log(page), { timeout: 8000 }).toEqual(['playback', 'auto']); // after the fade-out
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

test.describe('ring until dismissed', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { tones: number; notes: { opts: NotificationOptions; closed: boolean }[] };
      w.tones = 0;
      w.notes = [];
      const start = OscillatorNode.prototype.start;
      OscillatorNode.prototype.start = function (...args) {
        w.tones++;
        return start.apply(this, args);
      };
      class FakeNotification {
        static permission = 'granted';
        static requestPermission = async () => 'granted';
        onclick: (() => void) | null = null;
        rec: { opts: NotificationOptions; closed: boolean };
        constructor(_title: string, opts: NotificationOptions) {
          this.rec = { opts, closed: false };
          w.notes.push(this.rec);
        }
        close() {
          this.rec.closed = true;
        }
      }
      Object.defineProperty(window, 'Notification', { configurable: true, value: FakeNotification });
    });
  });
  const tones = (page: import('@playwright/test').Page) => page.evaluate(() => (window as unknown as { tones: number }).tones);
  const notes = (page: import('@playwright/test').Page) =>
    page.evaluate(() => (window as unknown as { notes: { opts: NotificationOptions; closed: boolean }[] }).notes);
  const endingSoon = () => {
    const seed = focusInProgress(0);
    seed.timer.endsAt = Date.now() + 1000;
    return seed;
  };
  // "digital" is 6 beeps, ~2.7s per ring including the gap.
  const settings = { alarm: 'digital', notifications: true, mobileTipSeen: true };

  test('keeps ringing, with a sticky notification, until you tap', async ({ page }) => {
    await open(page, { data: endingSoon(), settings: { ...settings, alarmUntilDismissed: true } });
    await expect.poll(() => tones(page), { timeout: 10_000 }).toBeGreaterThanOrEqual(12);
    expect((await notes(page))[0]).toMatchObject({ opts: { requireInteraction: true }, closed: false });

    await page.mouse.click(5, 5);
    const after = await tones(page);
    await page.waitForTimeout(3500);
    expect(await tones(page)).toBe(after);
    expect((await notes(page))[0].closed).toBe(true);
  });

  test('rings once when the setting is off (the default)', async ({ page }) => {
    await open(page, { data: endingSoon(), settings });
    await expect.poll(() => tones(page), { timeout: 5000 }).toBe(6);
    await page.waitForTimeout(3500);
    expect(await tones(page)).toBe(6);
    expect((await notes(page))[0].opts.requireInteraction).toBe(false);
  });
});
