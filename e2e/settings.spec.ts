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

test('GitHub link and version are shown in the footer and in About', async ({ page }) => {
  await open(page);
  await expect(page.locator('.app-foot').getByRole('link', { name: /The Pomodoro Technique/ })).toHaveAttribute('href', 'https://en.wikipedia.org/wiki/Pomodoro_Technique');
  const link = page.locator('.app-foot').getByRole('link', { name: 'Source on GitHub' });
  await expect(link).toHaveAttribute('href', 'https://github.com/parmsam/pomotimer2');
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(page.locator('.app-version')).toHaveText(/^v\d+\.\d+\.\d+$/);
  await page.locator('#settings-open').click();
  const about = page.getByRole('complementary', { name: 'Settings' }).locator('.about');
  await expect(about.getByRole('link', { name: 'Report an issue' })).toHaveAttribute('href', /\/issues\/new$/);
});

test('the whole switch is clickable, not just a corner (Safari regression)', async ({ page }) => {
  await open(page);
  await page.locator('#settings-open').click();
  for (const id of ['#set-tick', '#set-autoStartBreaks', '#set-muted']) {
    const input = page.locator(id);
    const sw = input.locator('..');
    await sw.scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
    const box = (await sw.boundingBox())!;
    const before = await input.isChecked();
    // Click the far side of the track, away from where a shrunken native checkbox would sit.
    await page.mouse.click(box.x + box.width * 0.8, box.y + box.height * 0.6);
    await expect(input).toBeChecked({ checked: !before });
    // Some WebKit builds shrink native checkboxes to 12x12, so the behavior above can pass
    // by luck. Pin the two things that make it robust everywhere:
    expect(await sw.evaluate((el) => el.tagName)).toBe('LABEL'); // clicking anywhere on a label toggles its input
    expect(await input.evaluate((el) => getComputedStyle(el).appearance)).toBe('none'); // lets the input fill the switch
  }
});
