import type { Page } from '@playwright/test';
import { expect, focusInProgress, open, storedSettings, test } from './helpers';

/** Dispatches a touch-type pointer sequence on the timer: dx/dy movement, held for `ms`. */
async function touch(page: Page, dx: number, dy = 0, ms = 60) {
  await page.evaluate(
    async ([dx, dy, ms]) => {
      const el = document.querySelector('.dial')!;
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      const ev = (type: string, cx: number, cy: number) =>
        el.dispatchEvent(new PointerEvent(type, { pointerType: 'touch', isPrimary: true, pointerId: 7, clientX: cx, clientY: cy, bubbles: true }));
      ev('pointerdown', x, y);
      await new Promise((r) => setTimeout(r, ms / 2));
      ev('pointermove', x + dx / 2, y + dy / 2);
      await new Promise((r) => setTimeout(r, ms / 2));
      ev('pointerup', x + dx, y + dy);
    },
    [dx, dy, ms],
  );
}

test.describe('touch gestures on the timer', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch devices');

  test('tap starts and pauses', async ({ page }) => {
    await open(page, { settings: { mobileTipSeen: true } });
    await touch(page, 0);
    await expect(page.locator('.primary-label')).toHaveText('Pause');
    await touch(page, 0);
    await expect(page.locator('.primary-label')).toHaveText('Resume');
  });

  test('swipe left/right changes mode (wrapping), vertical drags do nothing', async ({ page }) => {
    await open(page);
    await touch(page, -120);
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'short');
    await touch(page, -120);
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'long');
    await touch(page, -120);
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'focus');
    await touch(page, 120);
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'long');
    await touch(page, 10, 150); // a scroll, not a swipe or tap
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'long');
    await expect(page.locator('.primary-label')).toHaveText('Start');
  });

  test('swiping mid-focus asks before abandoning', async ({ page }) => {
    await open(page, { data: focusInProgress(5) });
    await touch(page, -120);
    await expect(page.getByRole('alertdialog')).toContainText('Switch to Short Break?');
  });

  test('holding restarts (asking first mid-session)', async ({ page }) => {
    await open(page, { data: focusInProgress(5) });
    await touch(page, 0, 0, 800);
    await expect(page.getByRole('alertdialog')).toContainText('Restart this pomodoro?');
    await expect(page.locator('.primary-label')).toHaveText('Pause'); // the hold didn't also toggle
  });

  test('first visit explains the gestures once', async ({ page }) => {
    await open(page, { settings: { gesturesTipSeen: false } });
    const tip = page.getByRole('status').filter({ hasText: 'swipe it to switch modes' });
    await expect(tip).toBeVisible({ timeout: 5000 });
    await tip.locator('.toast-close').click();
    expect((await storedSettings(page)).gesturesTipSeen).toBe(true);
  });
});

test('mouse clicks on the timer do nothing (gestures are touch-only)', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop');
  await open(page);
  await page.locator('.dial').click();
  await expect(page.locator('.primary-label')).toHaveText('Start');
});
