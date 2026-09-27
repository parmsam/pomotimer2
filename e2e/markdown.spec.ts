import { readFileSync } from 'node:fs';
import { expect, focusInProgress, open, stored, test } from './helpers';

const MD = `## Monday
- [ ] Write report 🍅3
- [x] Review PRs
- Plan sprint (2)`;

const idleWith = (tasks: unknown[]) => ({ ...focusInProgress(0), timer: { ...focusInProgress(0).timer, status: 'idle', endsAt: null }, tasks });

test('Import from Markdown: live preview, then adds tasks with estimates and done state', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Task options' }).click();
  await page.getByRole('menuitem', { name: 'Import from Markdown…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add tasks from Markdown' });
  await dialog.getByRole('textbox', { name: 'Markdown tasks' }).fill(MD);
  await expect(dialog.locator('.import-preview li')).toHaveCount(3);
  await expect(dialog.locator('.import-preview')).toContainText('1 line skipped');
  await dialog.getByRole('button', { name: 'Add 3 tasks' }).click();

  await expect(page.locator('.task-title')).toHaveText(['Write report', 'Review PRs', 'Plan sprint']);
  const d = await stored(page);
  expect(d.tasks.map((t: { estimate: number; done: boolean }) => [t.estimate, t.done])).toEqual([
    [3, false],
    [1, true],
    [2, false],
  ]);
  expect(d.activeTaskId).toBe(d.tasks[0].id);
});

test('pasting several lines into the new-task field opens the import preview', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'synthetic paste events carry data reliably only in Chromium');
  await open(page);
  const input = page.getByRole('textbox', { name: 'New task' });
  await input.focus();
  await input.evaluate((el, text) => {
    const dt = new DataTransfer();
    dt.setData('text/plain', text);
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, 'Email Sam\nBook dentist');
  const dialog = page.getByRole('dialog', { name: 'Add tasks from Markdown' });
  await expect(dialog.locator('.import-preview li')).toHaveCount(2);
  await page.keyboard.press('ControlOrMeta+Enter');
  await expect(page.locator('.task-title')).toHaveText(['Email Sam', 'Book dentist']);
});

test('Copy tasks as Markdown puts the export format on the clipboard', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'clipboard permissions are Chromium-only in Playwright');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await open(page, {
    data: idleWith([{ id: 'a', title: 'Draft report', estimate: 4, pomodoros: 2, trackedMs: 72 * 60_000, done: false, createdAt: 0, doneAt: null }]),
  });
  await page.getByRole('button', { name: 'Task options' }).click();
  await page.getByRole('menuitem', { name: 'Copy tasks as Markdown' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Tasks copied' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('- [ ] Draft report 🍅2/4 · 1h 12m');
});

test('the task menu works from the keyboard', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard');
  await open(page);
  await page.getByRole('button', { name: 'Task options' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitem').first()).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'Import from Markdown…' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Task options' })).toBeFocused();
});

test('Download log saves a Markdown session log', async ({ page }) => {
  const now = Date.now();
  await open(page, {
    data: {
      ...idleWith([{ id: 'a', title: 'Draft report', estimate: 2, pomodoros: 1, trackedMs: 0, done: false, createdAt: 0, doneAt: null }]),
      history: [{ mode: 'focus', endedAt: now - 60_000, durationMs: 25 * 60_000, focusedMs: 25 * 60_000, taskId: 'a' }],
    },
  });
  await page.locator('#settings-open').click();
  await page.locator('#log-range').selectOption('7');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download log (.md)' }).click()]);
  expect(download.suggestedFilename()).toMatch(/^pomo-log-\d{4}-\d{2}-\d{2}-7d\.md$/);
  const md = readFileSync((await download.path())!, 'utf8');
  expect(md).toContain('# Pomodoro log · last 7 days');
  expect(md).toContain('- [ ] Draft report 🍅1/2');
  expect(md).toContain('| Focus | Draft report | 25m |');
});
