import { expect, open, test } from './helpers';

test('bottom-right button enters and exits full screen', async ({ page, browserName }) => {
  await open(page);
  const btn = page.locator('#fullscreen');
  const supported = await page.evaluate(() => document.fullscreenEnabled);
  if (!supported) {
    await expect(btn).toBeHidden();
    return;
  }
  test.skip(browserName !== 'chromium', 'headless full screen is reliable in Chromium');
  const vp = page.viewportSize()!;
  if (vp.width > 600) {
    const box = (await btn.boundingBox())!;
    expect(box.x + box.width).toBeGreaterThan(vp.width - 40); // bottom-right corner
    expect(box.y + box.height).toBeGreaterThan(vp.height - 40);
  }

  await expect(btn).toHaveAttribute('aria-label', 'Full screen');
  await btn.click();
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
  await expect(btn).toHaveAttribute('aria-label', 'Exit full screen');
  await btn.click();
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(false);
  await expect(btn).toHaveAttribute('aria-label', 'Full screen');
});

test('the button never covers the footer at the end of the page', async ({ page }) => {
  await open(page);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const btn = page.locator('#fullscreen');
  if (!(await btn.isVisible())) return;
  const b = (await btn.boundingBox())!;
  // The footer box is full-width; what must stay uncovered is its actual text and links.
  for (const item of await page.locator('.app-foot > *').all()) {
    const f = await item.boundingBox();
    if (!f) continue;
    const overlap = !(b.x > f.x + f.width || b.x + b.width < f.x || b.y > f.y + f.height || b.y + b.height < f.y);
    expect(overlap).toBe(false);
  }
});

test('on phones the button sits at the end of the page instead of floating over content', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phones');
  await open(page);
  const btn = page.locator('#fullscreen');
  if (!(await btn.isVisible())) return;
  expect(await btn.evaluate((el) => getComputedStyle(el).position)).toBe('static');
  const b = (await btn.boundingBox())!;
  const f = (await page.locator('.app-foot').boundingBox())!;
  expect(b.y).toBeGreaterThan(f.y + f.height - 1);
});
