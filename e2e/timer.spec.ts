import { blur, expect, focusInProgress, MIN, open, stored, test } from './helpers';

test('counts down and shows the time in the tab title', async ({ page }) => {
  await open(page);
  await expect(page.locator('#time')).toHaveText('25:00');
  await page.locator('#toggle').click();
  await expect(page.locator('#time')).toHaveText(/24:5\d/, { timeout: 4000 });
  await expect(page).toHaveTitle(/24:5\d · Focus/);
  await expect(page.locator('.primary-label')).toHaveText('Pause');
});

test('a running session survives a reload', async ({ page }) => {
  await open(page);
  await page.locator('#toggle').click();
  await page.waitForTimeout(1200);
  await page.reload();
  await expect(page.locator('.primary-label')).toHaveText('Pause');
  expect((await stored(page)).timer.status).toBe('running');
});

test('space pauses and resumes', async ({ page }) => {
  await open(page);
  await blur(page);
  await page.keyboard.press('Space');
  await expect(page.locator('.primary-label')).toHaveText('Pause');
  await page.keyboard.press('Space');
  await expect(page.locator('.primary-label')).toHaveText('Resume');
});

test('a finished focus session moves to a short break and fills a cycle dot', async ({ page }) => {
  const seed = focusInProgress(0);
  seed.timer.endsAt = Date.now() + 1500;
  await open(page, { data: seed });
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'short', { timeout: 5000 });
  await expect(page.locator('#time')).toHaveText('05:00');
  await expect(page.locator('#cycle span.done')).toHaveCount(1);
  const d = await stored(page);
  expect(d.history).toHaveLength(1);
});

test('the mode pill lands on the new tab after the first completion adds a tab count', async ({ page }) => {
  const seed = focusInProgress(0);
  seed.timer.endsAt = Date.now() + 1500;
  await open(page, { data: seed });
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'short', { timeout: 5000 });
  const tab = page.getByRole('tab', { name: /Short Break/ });
  await expect(async () => {
    const pill = (await page.locator('.mode-pill').boundingBox())!;
    const box = (await tab.boundingBox())!;
    expect(Math.abs(pill.x - box.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(pill.width - box.width)).toBeLessThanOrEqual(2);
  }).toPass({ timeout: 3000 });
  await page.waitForTimeout(800); // and it stays there once every animation has settled
  const pill = (await page.locator('.mode-pill').boundingBox())!;
  expect(Math.abs(pill.x - (await tab.boundingBox())!.x)).toBeLessThanOrEqual(2);
});

test('a session that ended while closed is credited on load', async ({ page }) => {
  const seed = focusInProgress(26);
  seed.timer.cycleCount = 3;
  await open(page, { data: seed });
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'long');
});

test('ring progress sits exactly on the track', async ({ page }) => {
  // Regression: CSS transform-origin on SVG shifted the arc in some browsers.
  await open(page, { data: { ...focusInProgress(15), timer: { ...focusInProgress(15).timer, status: 'paused', endsAt: null, remainingMs: 10 * MIN } } });
  await page.waitForTimeout(1300); // let the load-time refill animation settle
  const svg = (await page.locator('svg.ring').boundingBox())!;
  const head = (await page.locator('.ring-head').boundingBox())!;
  const scale = svg.width / 220; // viewBox is 220 wide, track radius is 100
  const cx = svg.x + svg.width / 2;
  const cy = svg.y + svg.height / 2;
  const hx = head.x + head.width / 2;
  const hy = head.y + head.height / 2;
  // The playhead should lie on the track circle. The old bug was ~40px off; allow a few px
  // for rendering differences between platforms (Linux WebKit measured 2.5px).
  expect(Math.abs(Math.hypot(hx - cx, hy - cy) - 100 * scale)).toBeLessThan(4);
});

test('no horizontal scrolling', async ({ page }) => {
  await open(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});

test('top bar never overlaps the logo, even in a narrow desktop window', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await open(page);
  const brand = (await page.locator('.brand').boundingBox())!;
  const actions = (await page.locator('.topbar-actions').boundingBox())!;
  expect(brand.x + brand.width).toBeLessThanOrEqual(actions.x);
});
