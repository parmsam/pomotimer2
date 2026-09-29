import { expect, test } from './helpers';

test('has an installable manifest with icons', async ({ page, request }) => {
  await page.goto('./');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();
  const manifest = await (await request.get(new URL(href!, page.url()).toString())).json();
  expect(manifest).toMatchObject({ short_name: 'pomo', display: 'standalone', start_url: '/pomotimer2/' });
  for (const icon of manifest.icons as { src: string }[]) {
    expect((await request.get(new URL(icon.src, page.url()).toString())).status()).toBe(200);
  }
  expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);
  expect(manifest.shortcuts.map((x: { url: string }) => x.url)).toContain('/pomotimer2/?do=start&mode=focus');
});

test('publishes llms.txt for agents', async ({ page, request }) => {
  await page.goto('./');
  const res = await request.get(new URL('llms.txt', page.url()).toString());
  expect(res.status()).toBe(200);
  expect(await res.text()).toContain('window.pomo');
});

test('the service worker lets real files through instead of serving the app', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.goto('./llms.txt');
  await expect(page.locator('body')).toContainText('window.pomo');
});

test('works offline once loaded', async ({ page, context }) => {
  await page.goto('./');
  await expect(page.getByRole('status').filter({ hasText: 'works offline' })).toBeVisible({ timeout: 15_000 });
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // Start a session, then lose the network.
  await page.locator('#toggle').click();
  await page.waitForTimeout(400);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#time')).toHaveText(/2[45]:\d\d/);
  await expect(page.locator('.primary-label')).toHaveText('Pause');
  await context.setOffline(false);
});
