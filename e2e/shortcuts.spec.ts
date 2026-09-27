import { blur, expect, focusInProgress, open, stored, storedSettings, test } from './helpers';

test.describe('keyboard shortcuts', () => {
  test.skip(({ isMobile }) => isMobile, 'keyboard shortcuts are for desktop');

  test.beforeEach(async ({ page }) => {
    await open(page);
    await blur(page);
  });

  test('Space starts and pauses', async ({ page }) => {
    await page.keyboard.press('Space');
    await expect(page.locator('.primary-label')).toHaveText('Pause');
    await page.keyboard.press('Space');
    await expect(page.locator('.primary-label')).toHaveText('Resume');
  });

  test('1 / 2 / 3 switch modes', async ({ page }) => {
    await page.keyboard.press('2');
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'short');
    await page.keyboard.press('3');
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'long');
    await page.keyboard.press('1');
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'focus');
  });

  test('S skips and R restarts', async ({ page }) => {
    await page.keyboard.press('s');
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'short');
    await page.keyboard.press('Space');
    await page.waitForTimeout(1200);
    await page.keyboard.press('r');
    await expect(page.locator('#time')).toHaveText('05:00');
  });

  test(', opens and closes settings, Esc closes too', async ({ page }) => {
    const drawer = page.getByRole('complementary', { name: 'Settings' });
    await page.keyboard.press(',');
    await expect(drawer).toBeVisible();
    await page.keyboard.press(',');
    await expect(drawer).toBeHidden();
    await page.keyboard.press(',');
    await expect(drawer).toBeVisible();
    await drawer.locator('.durations input').first().focus();
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
  });

  test('? shows the cheat sheet listing every shortcut', async ({ page }) => {
    await page.keyboard.press('?');
    const sheet = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
    await expect(sheet).toBeVisible();
    for (const label of ['Start / pause', 'Focus / short break / long break', 'New task', 'Mute / unmute sounds', 'Open / close settings']) {
      await expect(sheet).toContainText(label);
    }
    // Shortcuts are paused while it's open.
    await page.keyboard.press('2');
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'focus');
    await page.keyboard.press('?');
    await expect(sheet).toBeHidden();
    await page.getByRole('button', { name: 'Keyboard shortcuts (?)' }).click();
    await expect(sheet).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
  });

  test('T toggles tasks, N focuses the new-task field', async ({ page }) => {
    await page.keyboard.press('t');
    await expect(page.locator('#tasks')).toBeHidden();
    await page.keyboard.press('n');
    await expect(page.locator('#tasks')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'New task' })).toBeFocused();
    // Typing letters in the field must not trigger shortcuts.
    await page.keyboard.type('Read 2 chapters');
    await expect(page.getByRole('textbox', { name: 'New task' })).toHaveValue('Read 2 chapters');
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'focus');
  });

  test('M mutes and unmutes', async ({ page }) => {
    await page.keyboard.press('m');
    await expect(page.getByRole('status').filter({ hasText: 'Sound off' })).toBeVisible();
    expect((await storedSettings(page)).muted).toBe(true);
    await page.keyboard.press('m');
    expect((await storedSettings(page)).muted).toBe(false);
  });
});

test('I logs an interruption during focus', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard shortcut');
  await open(page, { data: focusInProgress(2) });
  await blur(page);
  await page.keyboard.press('i');
  await page.getByRole('button', { name: /Internal/ }).click();
  expect((await stored(page)).timer.interruptions.internal).toBe(1);
});

test('first visit shows a one-time tip about shortcuts', async ({ page, isMobile }) => {
  test.skip(isMobile, 'tip is only for keyboard users');
  await open(page, { settings: { shortcutsHintSeen: false } });
  const tip = page.getByRole('status').filter({ hasText: 'press ? to see keyboard shortcuts' });
  await expect(tip).toBeVisible({ timeout: 5000 });
  await tip.getByRole('button', { name: 'Show' }).click();
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();
  expect((await storedSettings(page)).shortcutsHintSeen).toBe(true);
  await page.reload();
  await page.waitForTimeout(3500);
  await expect(tip).toHaveCount(0);
});

test('the shortcuts button is hidden on touch devices', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch only');
  await open(page);
  await expect(page.getByRole('button', { name: 'Keyboard shortcuts (?)' })).toBeHidden();
});

test.describe('task list keyboard control', () => {
  test.skip(({ isMobile }) => isMobile, 'keyboard shortcuts are for desktop');
  const task = (id: string) => ({ id, title: id.toUpperCase(), estimate: 1, pomodoros: 0, trackedMs: 0, done: false, createdAt: 0, doneAt: null });

  test.beforeEach(async ({ page }) => {
    await open(page, { data: { ...focusInProgress(0), timer: { ...focusInProgress(0).timer, status: 'idle', endsAt: null }, tasks: [task('a'), task('b'), task('c')], activeTaskId: null } });
    await blur(page);
  });

  const focusedTask = (page: import('@playwright/test').Page) =>
    page.evaluate(() => (document.activeElement?.closest('.task') as HTMLElement | null)?.dataset.id ?? null);

  test('N then ↓ enters the list; arrows, Home and End move between tasks', async ({ page }) => {
    await page.keyboard.press('n');
    await page.keyboard.press('ArrowDown');
    expect(await focusedTask(page)).toBe('a');
    await page.keyboard.press('ArrowDown');
    expect(await focusedTask(page)).toBe('b');
    await page.keyboard.press('End');
    expect(await focusedTask(page)).toBe('c');
    await page.keyboard.press('Home');
    expect(await focusedTask(page)).toBe('a');
    await page.keyboard.press('ArrowUp');
    await expect(page.getByRole('textbox', { name: 'New task' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('textbox', { name: 'New task' })).not.toBeFocused();
  });

  test('Enter sets the current task, X marks done, E edits, Del deletes, Alt+↓ reorders', async ({ page }) => {
    await page.keyboard.press('n');
    await page.keyboard.press('ArrowDown'); // a
    await page.keyboard.press('ArrowDown'); // b
    await page.keyboard.press('Enter');
    await expect(page.locator('.task[data-id="b"]')).toHaveClass(/active/);

    await page.keyboard.press('x');
    await expect(page.locator('.task[data-id="b"]')).toHaveClass(/done/);
    expect(await focusedTask(page)).toBe('b');

    await page.keyboard.press('e');
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('B renamed');
    await page.keyboard.press('Enter');
    await expect(page.locator('.task[data-id="b"] .task-title')).toHaveText('B renamed');
    expect(await focusedTask(page)).toBe('b');

    await page.keyboard.press('Alt+ArrowDown');
    expect((await stored(page)).tasks.map((t: { id: string }) => t.id)).toEqual(['a', 'c', 'b']);
    expect(await focusedTask(page)).toBe('b');

    await page.keyboard.press('Delete');
    await expect(page.locator('.task')).toHaveCount(2);
    expect(await focusedTask(page)).toBe('c'); // focus stays in the list

    // Keys handled by the list don't leak into global shortcuts (S = skip).
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'focus');
  });
});
