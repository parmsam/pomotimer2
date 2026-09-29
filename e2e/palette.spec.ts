import type { Page } from '@playwright/test';
import { blur, expect, focusInProgress, open, stored, storedSettings, test } from './helpers';

const palette = (page: Page) => page.getByRole('dialog', { name: 'Command palette' });
const search = (page: Page) => page.getByRole('combobox', { name: 'Command' });
const selected = (page: Page) => page.locator('.pal-option[aria-selected="true"]');

async function runCommand(page: Page, text: string, expectTitle?: string | RegExp) {
  await page.keyboard.press('ControlOrMeta+k');
  await expect(palette(page)).toBeVisible();
  await search(page).fill(text);
  if (expectTitle) await expect(selected(page).locator('.pal-title')).toHaveText(expectTitle);
  await page.keyboard.press('Enter');
  await expect(palette(page)).toBeHidden();
}

const task = (id: string, title: string) => ({ id, title, estimate: 1, pomodoros: 0, trackedMs: 0, done: false, createdAt: 1, doneAt: null });

test.describe('command palette', () => {
  test.skip(({ isMobile }) => isMobile, 'the palette is opened from the keyboard');

  test.beforeEach(async ({ page }) => {
    await open(page);
    await blur(page);
  });

  test('Cmd/Ctrl+K opens it with the search focused; Esc clears, then closes', async ({ page }) => {
    await page.keyboard.press('ControlOrMeta+k');
    await expect(palette(page)).toBeVisible();
    await expect(search(page)).toBeFocused();
    await expect(page.getByRole('listbox', { name: 'Commands' }).getByRole('option').first()).toBeVisible();
    await search(page).fill('theme');
    await page.keyboard.press('Escape');
    await expect(search(page)).toHaveValue('');
    await expect(palette(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(palette(page)).toBeHidden();
    // Toggles closed from the keyboard too.
    await page.keyboard.press('ControlOrMeta+k');
    await expect(palette(page)).toBeVisible();
    await page.keyboard.press('ControlOrMeta+k');
    await expect(palette(page)).toBeHidden();
  });

  test('typing never triggers the single-key shortcuts', async ({ page }) => {
    await page.keyboard.press('ControlOrMeta+k');
    await page.keyboard.type('2 s r');
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'focus');
    await expect(page.locator('.primary-label')).toHaveText('Start');
  });

  test('fuzzy search finds a face and highlights the match', async ({ page }) => {
    await page.keyboard.press('ControlOrMeta+k');
    await search(page).fill('tetrs');
    await expect(selected(page).locator('.pal-title')).toHaveText('Clock face: Tetris');
    await expect(selected(page).locator('mark').first()).toBeVisible();
    await page.keyboard.press('Enter');
    expect((await storedSettings(page)).clockFace).toBe('tetris');
  });

  test('arrow keys choose which result runs', async ({ page }) => {
    await page.keyboard.press('ControlOrMeta+k');
    await search(page).fill('switch to');
    await expect(selected(page)).toContainText('Switch to focus');
    await page.keyboard.press('ArrowDown');
    await expect(selected(page)).toContainText('Switch to short break');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp'); // wraps to the end
    await expect(page.locator('.pal-option').last()).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(selected(page)).toContainText('Switch to long break');
    await page.keyboard.press('Enter');
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'long');
  });

  test('clicking a result runs it and shows which option is current', async ({ page }) => {
    await page.keyboard.press('ControlOrMeta+k');
    await search(page).fill('theme');
    await expect(page.getByRole('option', { name: /Theme: Lofi Dusk.*current/ })).toBeVisible();
    await page.getByRole('option', { name: /Theme: Matcha/ }).click();
    await expect(palette(page)).toBeHidden();
    expect((await storedSettings(page)).theme).toBe('matcha');
  });

  test('"start 50m focus" starts a one-off 50 minute session without changing the setting', async ({ page }) => {
    await runCommand(page, 'Start 50m focus', 'Start a 50 min focus');
    await expect(page.locator('.primary-label')).toHaveText('Pause');
    await expect(page.locator('#time')).toHaveText(/^(50:00|49:5\d)$/);
    expect((await storedSettings(page)).durations?.focus ?? 25).toBe(25);
    // Restarting goes back to the usual length.
    await page.locator('#reset').click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Restart' }).click();
    await expect(page.locator('#time')).toHaveText('25:00');
  });

  test('"set focus to 40m" changes the saved length', async ({ page }) => {
    await runCommand(page, 'set focus to 40m', 'Set focus length to 40 min (now 25 min)');
    await expect(page.locator('#time')).toHaveText('40:00');
    expect((await storedSettings(page)).durations.focus).toBe(40);
  });

  test('"add task" adds a task with its estimate', async ({ page }) => {
    await runCommand(page, 'add task Write report 🍅3', 'Add task “Write report” · 3 pomodoros');
    await expect(page.locator('.task-list')).toContainText('Write report');
    const d = await stored(page);
    expect(d.tasks).toHaveLength(1);
    expect(d.tasks[0]).toMatchObject({ title: 'Write report', estimate: 3 });
  });

  test('"toggle rain" turns the ambient sound on, then off', async ({ page }) => {
    await runCommand(page, 'toggle rain', 'Ambient sound: Rain');
    expect((await storedSettings(page)).ambient).toBe('rain');
    await runCommand(page, 'toggle rain', 'Ambient sound: Rain');
    expect((await storedSettings(page)).ambient).toBe('off');
  });

  test('sets the current task', async ({ page }) => {
    await open(page, { data: { ...focusInProgress(0), timer: undefined, tasks: [task('a', 'Write report'), task('b', 'Email the team')], activeTaskId: 'a' } });
    await blur(page);
    await runCommand(page, 'current email', 'Set current task: Email the team');
    expect((await stored(page)).activeTaskId).toBe('b');
  });

  test('switching mode mid-pomodoro still asks first', async ({ page }) => {
    await open(page, { data: focusInProgress(5) });
    await blur(page);
    await runCommand(page, '5m break', 'Start a 5 min short break');
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText('Switch to Short Break?');
    await dialog.getByRole('button', { name: 'Switch' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'short');
    await expect(page.locator('.primary-label')).toHaveText('Pause');
  });

  test('is listed in the shortcuts cheat sheet', async ({ page }) => {
    await page.keyboard.press('?');
    await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toContainText('Command palette');
  });
});
