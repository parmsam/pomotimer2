import { blur, expect, focusInProgress, open, stored, test } from './helpers';

const task = (id: string, title: string) => ({ id, title, estimate: 2, pomodoros: 0, trackedMs: 0, done: false, createdAt: 0, doneAt: null });

test.describe('tasks', () => {
  test('adding tasks makes the first one active and shows it under the clock', async ({ page }) => {
    await open(page);
    const input = page.getByRole('textbox', { name: 'New task' });
    await input.fill('Write report');
    await page.getByRole('spinbutton', { name: 'Estimated pomodoros' }).first().fill('3');
    await input.press('Enter');
    await input.fill('Review PRs');
    await input.press('Enter');

    await expect(page.locator('.task')).toHaveCount(2);
    await expect(page.locator('.task.active .task-title')).toHaveText('Write report');
    await expect(page.locator('#sub')).toContainText('Write report');
    await expect(page.locator('#tasks-foot')).toContainText('4 🍅 to go');
  });

  test('focus time is split between tasks when switching mid-session', async ({ page }) => {
    await open(page, { data: { ...focusInProgress(0), timer: { ...focusInProgress(0).timer, status: 'idle', endsAt: null, segmentStart: null, remainingMs: 25 * 60_000 }, tasks: [task('a', 'A'), task('b', 'B')], activeTaskId: 'a' } });
    await page.locator('#toggle').click();
    await page.waitForTimeout(1500);
    await page.locator('.task[data-id="b"] .task-main').click();
    await page.waitForTimeout(1500);
    await page.locator('#toggle').click();
    const d = await stored(page);
    const [a, b] = d.tasks;
    expect(a.trackedMs).toBeGreaterThan(1000);
    expect(b.trackedMs).toBeGreaterThan(1000);
    expect(Math.abs(d.timer.focusedMs - a.trackedMs - b.trackedMs)).toBeLessThan(50);
  });

  test('completing the active task moves focus to the next open task', async ({ page }) => {
    await open(page, { data: { ...focusInProgress(0), timer: { ...focusInProgress(0).timer, status: 'idle', endsAt: null }, tasks: [task('a', 'A'), task('b', 'B')], activeTaskId: 'a' } });
    await page.locator('.task[data-id="a"] .task-check').click();
    await expect(page.locator('.task[data-id="a"]')).toHaveClass(/done/);
    await expect(page.locator('.task[data-id="b"]')).toHaveClass(/active/);
  });

  test('edit and delete', async ({ page }) => {
    await open(page, { data: { ...focusInProgress(0), timer: { ...focusInProgress(0).timer, status: 'idle', endsAt: null }, tasks: [task('a', 'A'), task('b', 'B')] } });
    await page.locator('.task[data-id="a"]').hover();
    await page.locator('.task[data-id="a"] .task-edit').click();
    await page.locator('.task-editor input[name="title"]').fill('A2');
    await page.locator('.task-editor input[name="title"]').press('Enter');
    await expect(page.locator('.task[data-id="a"] .task-title')).toHaveText('A2');
    await page.locator('.task[data-id="b"]').hover();
    await page.locator('.task[data-id="b"] .task-delete').click();
    await expect(page.locator('.task')).toHaveCount(1);
  });

  test('T toggles the task panel', async ({ page }) => {
    await open(page);
    await blur(page);
    await page.keyboard.press('t');
    await expect(page.locator('#tasks')).toBeHidden();
    await page.keyboard.press('t');
    await expect(page.locator('#tasks')).toBeVisible();
  });
});

test.describe('stopping a pomodoro early', () => {
  test('before halfway: asks, keeps focused minutes, records it as abandoned', async ({ page }) => {
    await open(page, { data: focusInProgress(5) });
    await blur(page);
    await page.keyboard.press('r');
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText('5 focused minutes');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    expect((await stored(page)).timer.status).toBe('running');

    await page.keyboard.press('r');
    await dialog.getByRole('button', { name: 'Restart' }).click();
    await expect(page.locator('.primary-label')).toHaveText('Start');
    const d = await stored(page);
    expect(d.timer).toMatchObject({ status: 'idle', mode: 'focus' });
    expect(d.history.at(-1)).toMatchObject({ abandoned: true });
    expect(d.history.at(-1).focusedMs).toBeGreaterThan(5 * 60_000 - 3000);
  });

  test('past halfway: skipping can still count the pomodoro', async ({ page }) => {
    await open(page, { data: focusInProgress(20) });
    await blur(page);
    await page.keyboard.press('s');
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText('Wrap up early?');
    await dialog.getByRole('button', { name: 'Count it' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'short');
    const d = await stored(page);
    expect(d.history.at(-1).abandoned).toBeUndefined();
  });

  test('switching modes while idle does not ask', async ({ page }) => {
    await open(page);
    await page.getByRole('tab', { name: 'Long Break' }).click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'long');
  });

  test('strict mode replaces Pause with Stop', async ({ page }) => {
    await open(page, { data: focusInProgress(2), settings: { strictMode: true } });
    await expect(page.locator('.primary-label')).toHaveText('Stop');
    await page.locator('#toggle').click();
    await expect(page.getByRole('alertdialog')).toContainText('Stop this pomodoro?');
  });
});

test('interruptions are tallied and notes become tasks', async ({ page }) => {
  await open(page, { data: focusInProgress(3) });
  await blur(page);
  await page.keyboard.press('i');
  await page.getByRole('textbox', { name: /Note/ }).fill('Call the bank');
  await page.getByRole('button', { name: /External/ }).click();
  await expect(page.locator('.interrupt-count')).toHaveText('1');
  await expect(page.locator('.task-title')).toHaveText(['Call the bank']);
  const d = await stored(page);
  expect(d.timer.interruptions).toEqual({ internal: 0, external: 1 });
});
