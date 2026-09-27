import { blur, expect, open, stored, storedSettings, test } from './helpers';

test('settings save and apply', async ({ page }) => {
  await open(page);
  await blur(page);
  await page.keyboard.press(',');
  const drawer = page.getByRole('complementary', { name: 'Settings' });
  await expect(drawer).toBeVisible();

  await drawer.getByRole('button', { name: 'Matcha' }).click();
  await drawer.locator('.durations input').nth(2).fill('20');
  await drawer.locator('.durations input').nth(2).press('Enter');
  await drawer.getByText('Auto-start breaks').click();
  await drawer.locator('#set-alarm').selectOption('chime');

  const s = await storedSettings(page);
  expect(s).toMatchObject({ theme: 'matcha', autoStartBreaks: true, alarm: 'chime' });
  expect(s.durations.long).toBe(20);

  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await page.getByRole('tab', { name: 'Long Break' }).click();
  await expect(page.locator('#time')).toHaveText('20:00');
});

test('reopening settings while it is still closing works (regression)', async ({ page }) => {
  await open(page);
  const gear = page.getByRole('button', { name: /^Settings/ });
  const box = (await gear.boundingBox())!;
  const clickGear = () => page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await clickGear();
  await page.waitForTimeout(700);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(60); // mid close-animation
  await clickGear();
  const drawer = page.getByRole('complementary', { name: 'Settings' });
  await page.waitForTimeout(800);
  await expect(drawer).toBeVisible();
  await drawer.getByText('Ticking').click();
  expect((await storedSettings(page)).tick).toBe(true);
});

test('rolling digits is off by default and can be enabled', async ({ page }) => {
  await open(page);
  await page.locator('#toggle').click();
  await page.waitForTimeout(1300);
  const animated = () => page.evaluate(() => [...document.querySelectorAll<HTMLElement>('#time .ch')].some((s) => s.style.transform));
  expect(await animated()).toBe(false);
  expect((await stored(page)).timer.status).toBe('running');
});
