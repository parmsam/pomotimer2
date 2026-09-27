import { blur, expect, focusInProgress, open, stored, test } from './helpers';

const MIN = 60_000;
/** Noon, `daysAgo` local days back. */
const dayAt = (daysAgo: number) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(12, 0, 0, 0);
  return d.getTime();
};
const focusRec = (daysAgo: number) => ({ mode: 'focus', endedAt: dayAt(daysAgo), durationMs: 25 * MIN, focusedMs: 25 * MIN });
const breakRec = (daysAgo: number, mode = 'short') => ({ mode, endedAt: dayAt(daysAgo), durationMs: 5 * MIN });
const idle = () => ({ ...focusInProgress(0), timer: { ...focusInProgress(0).timer, status: 'idle', endsAt: null, remainingMs: 25 * MIN } });

test('mode tabs show today’s completed sessions', async ({ page }) => {
  await open(page, { data: { ...idle(), history: [focusRec(0), focusRec(0), breakRec(0), focusRec(1)] } });
  await expect(page.getByRole('tab', { name: /Focus/ }).locator('.mode-count')).toHaveText('2');
  await expect(page.getByRole('tab', { name: /Short Break/ }).locator('.mode-count')).toHaveText('1');
  await expect(page.getByRole('tab', { name: /Long Break/ }).locator('.mode-count')).toBeHidden();
});

test('streak chip counts consecutive days and lights up once today counts', async ({ page }) => {
  await open(page, { data: { ...idle(), history: [focusRec(2), focusRec(1)] } });
  const chip = page.locator('#streak');
  await expect(chip.locator('.streak-count')).toHaveText('2');
  await expect(chip).not.toHaveClass(/lit/);
  await expect(chip).toHaveAttribute('aria-label', /focus today to keep it going/);

  await open(page, { data: { ...idle(), history: [focusRec(2), focusRec(1), focusRec(0)] } });
  await expect(chip.locator('.streak-count')).toHaveText('3');
  await expect(chip).toHaveClass(/lit/);
});

test('reaching the daily goal celebrates once', async ({ page }) => {
  const seed = { ...focusInProgress(0), history: [focusRec(0)] };
  seed.timer.endsAt = Date.now() + 1500;
  await open(page, { data: seed, settings: { dailyGoal: 2 } });
  await expect(page.locator('.goal-text')).toHaveText('1 of 2 today');
  const cheer = page.getByRole('status').filter({ hasText: 'Daily goal reached' });
  await expect(cheer).toBeVisible({ timeout: 5000 });
  await expect(page.locator('.goal-text')).toHaveText('Goal reached · 2 today');
  expect((await stored(page)).goalCelebratedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);

  // A third pomodoro the same day doesn't celebrate again.
  await page.locator('.toast-close').click();
  const again = { ...(await stored(page)) };
  again.timer = { ...focusInProgress(0).timer, endsAt: Date.now() + 1200 };
  await page.evaluate((d) => localStorage.setItem('pomo:v1:data', JSON.stringify(d)), again);
  await page.reload();
  await expect(page.locator('.goal-text')).toHaveText('Goal reached · 3 today', { timeout: 5000 });
  await page.waitForTimeout(600);
  await expect(cheer).toHaveCount(0);
});

test('progress dialog: tiles, a 7-day chart with tooltips, and a data table', async ({ page, isMobile }) => {
  await open(page, { data: { ...idle(), history: [focusRec(0), focusRec(0), focusRec(3), focusRec(10)] } });
  if (isMobile) await page.locator('#streak').tap();
  else {
    await blur(page);
    await page.keyboard.press('g');
  }
  const dialog = page.getByRole('dialog', { name: 'Your progress' });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.tile').first()).toContainText('2 pomodoros');
  await expect(dialog.locator('.tile').nth(3)).toContainText('4 pomodoros');
  await expect(dialog.locator('.bar')).toHaveCount(7);
  await expect(dialog.locator('.bar.today .bar-value')).toHaveText('50m');
  await expect(dialog.locator('table tbody tr')).toHaveCount(7);

  if (!isMobile) {
    await dialog.locator('.bar').nth(3).hover();
    await expect(dialog.locator('.chart-tip')).toContainText('1 pomodoro');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  }
});

test('daily goal is configurable', async ({ page }) => {
  await open(page, { data: { ...idle(), history: [focusRec(0)] } });
  await page.locator('#settings-open').click();
  await page.locator('#set-daily-goal').fill('3');
  await page.locator('#set-daily-goal').press('Enter');
  await expect(page.locator('.goal-text')).toHaveText('1 of 3 today');
});

test('two tabs stay in sync', async ({ page, context }) => {
  await open(page);
  const other = await context.newPage();
  await other.goto('./');
  await expect(other.locator('#time')).toHaveText('25:00');

  // Start in one tab → the other follows.
  await page.locator('#toggle').click();
  await expect(other.locator('.primary-label')).toHaveText('Pause', { timeout: 3000 });

  // Add a task in the other tab → it shows up here.
  await other.getByRole('textbox', { name: 'New task' }).fill('Synced task');
  await other.getByRole('textbox', { name: 'New task' }).press('Enter');
  await expect(page.locator('.task-title')).toHaveText(['Synced task'], { timeout: 3000 });

  // Pause here → the other tab stops too.
  await page.locator('#toggle').click();
  await expect(other.locator('.primary-label')).toHaveText('Resume', { timeout: 3000 });
});
