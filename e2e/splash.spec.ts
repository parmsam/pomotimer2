import { expect, open, storedSettings, test } from './helpers';

test('the splash shows on launch by default, then lifts on its own', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const splash = page.locator('#splash');
  await expect(splash).toBeVisible();
  await expect(splash).toContainText('pomo');
  await expect(splash).toHaveCount(0, { timeout: 4000 });
  await expect(page.locator('#toggle')).toBeVisible();
});

test('a tap or key press skips the splash without also starting the timer', async ({ page }) => {
  await open(page, { settings: { splash: true } });
  await expect(page.locator('#splash')).toBeVisible();
  await page.keyboard.press('Space');
  await expect(page.locator('#splash')).toHaveCount(0);
  await page.waitForTimeout(300);
  await expect(page.locator('.primary-label')).toHaveText('Start');

  await page.reload();
  await expect(page.locator('#splash')).toBeVisible();
  await page.mouse.click(10, 10);
  await expect(page.locator('#splash')).toHaveCount(0);
});

test('turning the splash off in settings keeps it hidden on the next launch', async ({ page }) => {
  await open(page, { settings: { splash: true } });
  await expect(page.locator('#splash')).toHaveCount(0, { timeout: 4000 });
  await page.locator('#settings-open').click();
  const input = page.locator('#set-splash');
  await expect(input).toBeChecked();
  await input.locator('..').click();
  expect((await storedSettings(page)).splash).toBe(false);

  await page.reload({ waitUntil: 'commit' });
  await page.waitForSelector('#splash', { state: 'attached' });
  await expect(page.locator('#splash')).toBeHidden();
});
