import { expect, focusInProgress, open, stored, storedSettings, test } from './helpers';

test.describe('window.pomo scripting API', () => {
  test.beforeEach(async ({ page }) => open(page));

  test('drives the timer and the UI follows', async ({ page }) => {
    expect(await page.evaluate(() => window.pomo!.help())).toContain('pomo.start');
    const s = await page.evaluate(() => window.pomo!.start({ mode: 'short', minutes: 10, task: 'Write report' }));
    expect(s).toMatchObject({ mode: 'short', status: 'running', durationMs: 600_000, task: { title: 'Write report' } });
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'short');
    await expect(page.locator('.primary-label')).toHaveText('Pause');
    await expect(page.locator('.task-list')).toContainText('Write report');

    await page.evaluate(() => window.pomo!.pause());
    await expect(page.locator('.primary-label')).toHaveText('Resume');
    expect((await stored(page)).timer.status).toBe('paused');
  });

  test('runs palette commands by id or typed text', async ({ page }) => {
    const ids = await page.evaluate(() => window.pomo!.commands().map((c) => c.id));
    expect(ids).toContain('Theme:matcha');
    await page.evaluate(() => window.pomo!.run('theme:matcha'));
    expect((await storedSettings(page)).theme).toBe('matcha');
    await page.evaluate(() => window.pomo!.run('set focus to 50m'));
    expect((await storedSettings(page)).durations.focus).toBe(50);
  });

  test('errors explain what went wrong', async ({ page }) => {
    const message = await page.evaluate(() => {
      try {
        window.pomo!.start({ minutes: -3 });
        return '';
      } catch (e) {
        return (e as Error).message;
      }
    });
    expect(message).toMatch(/minutes must be/);
  });
});

test.describe('link actions', () => {
  test('?do=start starts a one-off session and clears itself from the URL', async ({ page }) => {
    await open(page);
    await page.goto('./?do=start&mode=long&min=20&task=Plan+sprint');
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'long');
    await expect(page.locator('.primary-label')).toHaveText('Pause');
    await expect(page.locator('.task-list')).toContainText('Plan sprint');
    expect(new URL(page.url()).search).toBe('');
    const data = await stored(page);
    expect(data.timer.plannedMs).toBe(20 * 60_000);

    // Reloading doesn't run it again (the task isn't added twice).
    await page.evaluate(() => window.pomo!.pause());
    await page.reload();
    await expect(page.locator('.primary-label')).toHaveText('Resume');
    await expect(page.locator('.task-list li')).toHaveCount(1);
  });

  test('switching away from a focus session in progress still asks first', async ({ page }) => {
    await open(page, { data: focusInProgress(5) });
    await page.goto('./?do=start&mode=short');
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText('Switch to Short Break?');
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'focus');
  });

  test('?do=add-task adds a task without starting the timer', async ({ page }) => {
    await open(page);
    await page.goto('./?do=add-task&task=Email+the+team&estimate=2');
    await expect(page.locator('.task-list')).toContainText('Email the team');
    await expect(page.locator('.primary-label')).toHaveText('Start');
    expect((await stored(page)).tasks[0]).toMatchObject({ title: 'Email the team', estimate: 2 });
  });

  test('a broken link says why instead of failing silently', async ({ page }) => {
    await open(page);
    await page.goto('./?do=start&mode=nap');
    await expect(page.getByRole('status').filter({ hasText: 'Couldn’t run that link' })).toContainText('nap');
    await expect(page.locator('.primary-label')).toHaveText('Start');
  });
});
