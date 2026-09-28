import { blur, expect, open, test } from './helpers';

test('+ and − add or remove a minute', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard');
  await open(page);
  await blur(page);
  await page.keyboard.press('+');
  await expect(page.locator('#time')).toHaveText('26:00');
  await page.keyboard.press('-');
  await page.keyboard.press('-');
  await expect(page.locator('#time')).toHaveText('24:00');
  await page.keyboard.press('Space');
  await page.keyboard.press('=');
  await expect(page.locator('#time')).toHaveText(/24:5\d|25:00/);
});

test('the tab icon shows progress while a session runs', async ({ page }) => {
  await open(page);
  const icon = page.locator('link[rel="icon"]');
  await expect(icon).toHaveAttribute('type', 'image/svg+xml');
  await page.locator('#toggle').click();
  await expect(icon).toHaveAttribute('href', /^data:image\/png/);
  // Restarting mid-session asks first; once idle, the normal icon returns.
  await page.locator('#reset').click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Restart' }).click();
  await expect(icon).toHaveAttribute('type', 'image/svg+xml');
});

test('keeps the screen awake while running', async ({ page }) => {
  await page.addInitScript(() => {
    const log: string[] = [];
    (window as unknown as { wakeLog: string[] }).wakeLog = log;
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: {
        request: async () => {
          log.push('request');
          const s = new EventTarget() as EventTarget & { release(): Promise<void> };
          s.release = async () => {
            log.push('release');
            s.dispatchEvent(new Event('release'));
          };
          return s;
        },
      },
    });
  });
  await open(page);
  const log = () => page.evaluate(() => (window as unknown as { wakeLog: string[] }).wakeLog);
  await page.locator('#toggle').click();
  await expect.poll(log).toEqual(['request']);
  await page.locator('#toggle').click();
  await expect.poll(log).toEqual(['request', 'release']);
});

test.describe('pop-out mini timer', () => {
  test('mirrors the clock and controls the real timer', async ({ page, context, isMobile }) => {
    test.skip(isMobile, 'desktop feature');
    // Stand-in for Document Picture-in-Picture: a popup window we can inspect.
    await page.addInitScript(() => {
      (window as unknown as { documentPictureInPicture: unknown }).documentPictureInPicture = {
        window: null,
        requestWindow: async () => window.open('', 'pip', 'width=280,height=330')!,
      };
    });
    await open(page);
    const [popup] = await Promise.all([context.waitForEvent('page'), page.getByRole('button', { name: /Pop out mini timer/ }).click()]);
    await expect(popup.getByRole('timer')).toHaveText('25:00');
    await expect(popup.locator('.sub')).toHaveText('Focus');
    await popup.locator('.pip-toggle').click();
    await expect(page.locator('.primary-label')).toHaveText('Pause');
    await expect(popup.locator('.pip-toggle')).toHaveText('Pause');
    await expect(popup.getByRole('timer')).toHaveText(/24:5\d/, { timeout: 4000 });
  });

  test('shows the same clock face and theme as the page, and follows changes', async ({ page, context, isMobile }) => {
    test.skip(isMobile, 'desktop feature');
    await page.addInitScript(() => {
      (window as unknown as { documentPictureInPicture: unknown }).documentPictureInPicture = {
        window: null,
        requestWindow: async () => window.open('', 'pip', 'width=280,height=330')!,
      };
    });
    await open(page, { settings: { clockFace: 'tomato', theme: 'matcha' } });
    const [popup] = await Promise.all([context.waitForEvent('page'), page.getByRole('button', { name: /Pop out mini timer/ }).click()]);
    await expect(popup.locator('.dial')).toHaveAttribute('data-face', 'tomato');
    await expect(popup.locator('svg.tomato')).toHaveCount(1);
    // Theme tokens and face styles are carried over.
    const bg = await popup.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());
    expect(bg).toBe(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()));
    expect(await popup.locator('.tomato-leaves').evaluate((el) => getComputedStyle(el).fill)).not.toBe('rgb(0, 0, 0)');

    // Change the face on the page → the pop-out follows.
    await page.locator('#settings-open').click();
    await page.getByRole('group', { name: 'Clock face' }).getByRole('button', { name: 'Hourglass', exact: true }).click();
    await expect(popup.locator('.dial')).toHaveAttribute('data-face', 'hourglass');
    await expect(popup.locator('svg.hourglass')).toHaveCount(1);
  });

  test('the button is hidden where the API is missing', async ({ page, browserName }) => {
    test.skip(browserName === 'chromium', 'Chromium may have the real API');
    await open(page);
    await expect(page.locator('#pip-open')).toBeHidden();
  });
});
