import { expect, open, storedSettings, test } from './helpers';

test.describe('three.js backgrounds', () => {
  test.skip(({ browserName, isMobile }) => browserName !== 'chromium' || isMobile, 'WebGL in headless Chromium only');

  test('three.js is not downloaded unless a scene is chosen', async ({ page }) => {
    const threeRequests: string[] = [];
    page.on('request', (r) => /three/.test(r.url()) && threeRequests.push(r.url()));
    await open(page);
    await page.waitForTimeout(800);
    expect(threeRequests).toEqual([]);
    await expect(page.locator('.bg')).toHaveAttribute('data-background', 'blobs');
  });

  test('choosing a scene runs it; choosing Blobs removes it', async ({ page }) => {
    await open(page);
    await page.locator('#settings-open').click();
    const group = page.getByRole('group', { name: 'Background' });
    await group.getByRole('button', { name: 'Aurora' }).click();
    await expect(page.locator('.bg canvas.scene')).toHaveCount(1);
    await expect(page.locator('.bg')).toHaveAttribute('data-scene-ready', 'true', { timeout: 10_000 });
    await expect(page.locator('.bg .blob').first()).toBeHidden();
    expect((await storedSettings(page)).background).toBe('aurora');

    await group.getByRole('button', { name: 'Fireflies' }).click();
    await expect(page.locator('.bg')).toHaveAttribute('data-scene-ready', 'true', { timeout: 10_000 });
    await expect(page.locator('.bg canvas.scene')).toHaveCount(1); // replaced, not stacked

    await group.getByRole('button', { name: 'Blobs' }).click();
    await expect(page.locator('.bg canvas.scene')).toHaveCount(0);
    await expect(page.locator('.bg .blob').first()).toBeVisible();
  });

  test('reduced motion never starts a scene', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, { settings: { background: 'rain' } });
    await page.waitForTimeout(800);
    await expect(page.locator('.bg canvas.scene')).toHaveCount(0);
    await expect(page.locator('.bg')).toHaveAttribute('data-background', 'none');
  });
});
