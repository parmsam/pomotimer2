import { readFileSync } from 'node:fs';
import { blur, expect, focusInProgress, open, stored, storedSettings, test } from './helpers';

const openSettings = async (page: import('@playwright/test').Page) => {
  await page.locator('#settings-open').click();
  const drawer = page.getByRole('complementary', { name: 'Settings' });
  await expect(drawer).toBeVisible();
  return drawer;
};

test('interval presets set all three durations', async ({ page }) => {
  await open(page);
  const drawer = await openSettings(page);
  const preset = drawer.getByRole('button', { name: /50 minute focus/ });
  await preset.click();
  await expect(preset).toHaveAttribute('aria-pressed', 'true');
  await expect(drawer.getByRole('button', { name: /25 minute focus/ })).toHaveAttribute('aria-pressed', 'false');
  expect((await storedSettings(page)).durations).toEqual({ focus: 50, short: 10, long: 20 });
  await expect(page.locator('#time')).toHaveText('50:00');
});

test('each mode can have its own color, and reset goes back to the theme', async ({ page }) => {
  await open(page);
  const drawer = await openSettings(page);
  await drawer.getByLabel('Short break color').evaluate((el: HTMLInputElement) => {
    el.value = '#123456';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const shortVar = () => page.evaluate(() => document.documentElement.style.getPropertyValue('--short'));
  expect(await shortVar()).toBe('#123456');
  expect((await storedSettings(page)).modeColors.short).toBe('#123456');
  await drawer.getByRole('button', { name: 'Use theme colors' }).click();
  expect(await shortVar()).not.toBe('#123456');
  await expect(drawer.getByRole('button', { name: 'Use theme colors' })).toBeHidden();
});

test('an old single accent color carries over to the focus color', async ({ page }) => {
  await open(page, { settings: { accent: '#00ff88' } });
  expect(await page.evaluate(() => document.documentElement.style.getPropertyValue('--focus'))).toBe('#00ff88');
});

test.describe('focus mode', () => {
  test('F toggles it; Esc and the exit button leave it', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard');
    await open(page);
    await blur(page);
    await page.keyboard.press('f');
    await expect(page.locator('body')).toHaveClass(/focus-mode/);
    await expect(page.locator('.topbar')).toBeHidden();
    await expect(page.locator('#tasks')).toBeHidden();
    await expect(page.locator('#toggle')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('body')).not.toHaveClass(/focus-mode/);
    await page.keyboard.press('f');
    await page.getByRole('button', { name: /Exit focus mode/ }).click();
    await expect(page.locator('.topbar')).toBeVisible();
  });

  test('can turn on automatically when focus starts and off when it ends', async ({ page }) => {
    await open(page, { settings: { focusModeOnStart: true } });
    await page.locator('#toggle').click();
    await expect(page.locator('body')).toHaveClass(/focus-mode/);
    await stored(page); // let the pending save land so it can't overwrite the seed on unload

    const seed = focusInProgress(0);
    seed.timer.endsAt = Date.now() + 1200;
    await page.evaluate((d) => localStorage.setItem('pomo:v1:data', JSON.stringify(d)), seed);
    await page.reload();
    await page.evaluate(() => document.body.classList.add('focus-mode')); // as if it had been on
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'short', { timeout: 5000 });
    await expect(page.locator('body')).not.toHaveClass(/focus-mode/);
  });
});

test('breaks show a tip', async ({ page }) => {
  await open(page);
  await page.getByRole('tab', { name: /Short Break/ }).click();
  await expect(page.locator('#sub')).not.toHaveText('');
  await expect(page.locator('#sub')).not.toContainText('#');
});

test.describe('backup', () => {
  const task = { id: 'a', title: 'From backup', estimate: 2, pomodoros: 1, trackedMs: 0, done: false, createdAt: 0, doneAt: null };

  test('export downloads a backup that includes tasks and settings', async ({ page }) => {
    await open(page, { data: { ...focusInProgress(0), timer: { ...focusInProgress(0).timer, status: 'idle', endsAt: null }, tasks: [task] }, settings: { dailyGoal: 5 } });
    const drawer = await openSettings(page);
    const [download] = await Promise.all([page.waitForEvent('download'), drawer.getByRole('button', { name: 'Export backup' }).click()]);
    expect(download.suggestedFilename()).toMatch(/^pomo-backup-\d{4}-\d{2}-\d{2}\.json$/);
    const json = JSON.parse(readFileSync((await download.path())!, 'utf8'));
    expect(json).toMatchObject({ app: 'pomotimer2', version: 1, settings: { dailyGoal: 5 } });
    expect(json.data.tasks[0].title).toBe('From backup');
  });

  test('import asks first, then restores', async ({ page }) => {
    await open(page);
    const drawer = await openSettings(page);
    const backup = { app: 'pomotimer2', version: 1, exportedAt: new Date().toISOString(), settings: { theme: 'matcha', dailyGoal: 3 }, data: { tasks: [task], history: [] } };
    await drawer.locator('#import-file').setInputFiles({ name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText('1 tasks and 0 pomodoros');
    await dialog.getByRole('button', { name: 'Replace' }).click();
    await expect(page.locator('.task-title')).toHaveText(['From backup']);
    expect((await storedSettings(page)).theme).toBe('matcha');
    expect((await stored(page)).tasks).toHaveLength(1);
  });

  test('a bad file shows a friendly error and changes nothing', async ({ page }) => {
    await open(page);
    const drawer = await openSettings(page);
    await drawer.locator('#import-file').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"nope":true}') });
    await expect(page.getByRole('status').filter({ hasText: 'doesn’t look like a pomo backup' })).toBeVisible();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
  });

  test('reset asks with an in-app dialog', async ({ page }) => {
    await open(page, { data: { ...focusInProgress(0), timer: { ...focusInProgress(0).timer, status: 'idle', endsAt: null }, tasks: [task] } });
    const drawer = await openSettings(page);
    await drawer.getByRole('button', { name: 'Reset everything' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Reset' }).click();
    await expect(page.locator('.task')).toHaveCount(0);
  });
});
