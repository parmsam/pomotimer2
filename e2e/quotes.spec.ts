import { expect, open, storedSettings, test } from './helpers';

test('quotes are off by default', async ({ page }) => {
  await open(page);
  await expect(page.locator('#quote')).toBeHidden();
});

test('turning quotes on shows one with its author', async ({ page }) => {
  await open(page);
  await page.locator('#settings-open').click();
  await page.locator('label[for="set-showQuotes"]').click();
  expect((await storedSettings(page)).showQuotes).toBe(true);
  await page.keyboard.press('Escape');
  const quote = page.locator('#quote');
  await expect(quote).toBeVisible();
  await expect(quote.locator('blockquote')).not.toBeEmpty();
  await expect(quote.locator('figcaption')).toHaveText(/^— \S/);
});

test('a new session brings a new quote; starting and pausing do not', async ({ page }) => {
  await open(page, { settings: { showQuotes: true } });
  const text = page.locator('#quote blockquote');
  const first = await text.textContent();
  await page.locator('#toggle').click();
  await page.locator('#toggle').click();
  await page.waitForTimeout(900);
  await expect(text).toHaveText(first!);
  await page.getByRole('tab', { name: /Short Break/ }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Switch' }).click(); // the paused pomodoro is still in progress
  await expect(text).not.toHaveText(first!, { timeout: 3000 });
});

test('my own quotes can replace the built-in list', async ({ page }) => {
  await open(page, { settings: { showQuotes: true } });
  await page.locator('#settings-open').click();
  await page.locator('#set-quote-source').selectOption('custom');
  await page.getByRole('textbox', { name: 'My quotes, one per line' }).fill('Ship small, ship often. — Me');
  await page.getByRole('textbox', { name: 'My quotes, one per line' }).blur();
  await expect(page.locator('#quote blockquote')).toHaveText('Ship small, ship often.');
  await expect(page.locator('#quote figcaption')).toHaveText('— Me');
});

test('focus mode hides the quote', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard');
  await open(page, { settings: { showQuotes: true } });
  await expect(page.locator('#quote')).toBeVisible();
  await page.keyboard.press('f');
  await expect(page.locator('#quote')).toBeHidden();
});
