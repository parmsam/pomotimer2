import { expect, focusInProgress, MIN, open, stored, test } from './helpers';

const task = (extra: Record<string, unknown> = {}) => ({
  id: 'a',
  title: 'Write report',
  estimate: 2,
  pomodoros: 0,
  trackedMs: 0,
  done: false,
  createdAt: 1,
  doneAt: null,
  ...extra,
});

/** A pomodoro on task "a" that ends a few seconds after the page loads. */
function endingSoon() {
  const seed = focusInProgress(0, { tasks: [task()], activeTaskId: 'a' });
  seed.timer.endsAt = Date.now() + 3000;
  return seed;
}

test('a finished pomodoro can be undone from its toast', async ({ page }) => {
  await open(page, { data: endingSoon() });
  const toast = page.getByRole('status').filter({ hasText: 'Pomodoro counted' });
  await expect(toast).toBeVisible({ timeout: 6000 });
  await expect(page.locator('#cycle span.done')).toHaveCount(1);
  await toast.getByRole('button', { name: 'Undo' }).click();

  await expect(page.locator('html')).toHaveAttribute('data-mode', 'focus');
  await expect(page.locator('#time')).toHaveText('25:00');
  await expect(page.locator('#cycle span.done')).toHaveCount(0);
  const d = await stored(page);
  expect(d.history).toEqual([]);
  expect(d.tasks[0].pomodoros).toBe(0);
  expect(d.timer.cycleCount).toBe(0);
});

test('undo also stops an auto-started break', async ({ page }) => {
  await open(page, { data: endingSoon(), settings: { autoStartBreaks: true } });
  const toast = page.getByRole('status').filter({ hasText: 'Pomodoro counted' });
  await expect(toast).toBeVisible({ timeout: 6000 });
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'short');
  await toast.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'focus');
  await expect(page.locator('.primary-label')).toHaveText('Start');
});

test('a pomodoro that finished while the page was closed can be undone too', async ({ page }) => {
  const seed = focusInProgress(30);
  seed.timer.endsAt = Date.now() - 5 * MIN;
  await open(page, { data: seed });
  const toast = page.getByRole('status').filter({ hasText: 'finished while you were away' });
  await toast.getByRole('button', { name: 'Undo' }).click();
  expect((await stored(page)).history).toEqual([]);
});

test('sessions can be deleted from the progress view, with undo', async ({ page }) => {
  const now = Date.now();
  const rec = (mins: number, extra = {}) => ({ mode: 'focus', endedAt: now - mins * MIN, durationMs: 25 * MIN, focusedMs: 25 * MIN, taskId: 'a', ...extra });
  await open(page, {
    data: {
      ...focusInProgress(0),
      timer: undefined,
      history: [rec(90), rec(30, { abandoned: true, focusedMs: 8 * MIN })],
      tasks: [task({ pomodoros: 1, trackedMs: 33 * MIN })],
      activeTaskId: 'a',
    },
  });
  await page.locator('#streak').click();
  const dialog = page.getByRole('dialog', { name: 'Your progress' });
  const list = dialog.getByRole('list', { name: 'Recent sessions' });
  await expect(list.getByRole('listitem')).toHaveCount(2);
  await expect(list.getByRole('listitem').first()).toContainText('8m · stopped early · Write report');
  await expect(dialog).toContainText('1 pomodoro');

  // Delete the finished one (newest first, so it's second).
  await list.getByRole('listitem').nth(1).getByRole('button', { name: /Delete/ }).click();
  await expect(list.getByRole('listitem')).toHaveCount(1);
  let d = await stored(page);
  expect(d.history).toHaveLength(1);
  expect(d.tasks[0]).toMatchObject({ pomodoros: 0, trackedMs: 8 * MIN });

  await page.getByRole('status').filter({ hasText: 'Pomodoro deleted' }).getByRole('button', { name: 'Undo' }).click();
  await expect(list.getByRole('listitem')).toHaveCount(2);
  d = await stored(page);
  expect(d.history.map((h: { endedAt: number }) => h.endedAt)).toEqual([now - 90 * MIN, now - 30 * MIN]);
  expect(d.tasks[0]).toMatchObject({ pomodoros: 1, trackedMs: 33 * MIN });
});
