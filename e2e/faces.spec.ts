import { expect, focusInProgress, open, stored, test } from './helpers';

const MIN = 60_000;
const history = (n: number) => Array.from({ length: n }, (_, i) => ({ mode: 'focus', endedAt: Date.now() - (i + 1) * 3_600_000, durationMs: 25 * MIN, focusedMs: 25 * MIN }));

test('the ring is the default face', async ({ page }) => {
  await open(page);
  await expect(page.locator('.dial')).toHaveAttribute('data-face', 'ring');
  await expect(page.locator('svg.ring')).toHaveCount(1);
});

test('switching faces in settings keeps the accessible clock', async ({ page }) => {
  await open(page);
  await page.locator('#settings-open').click();
  const faces = page.getByRole('group', { name: 'Clock face' });
  await faces.getByRole('button', { name: 'Tomato' }).click();
  await expect(page.locator('.dial')).toHaveAttribute('data-face', 'tomato');
  await expect(page.locator('svg.tomato')).toHaveCount(1);
  await expect(page.locator('svg.ring')).toHaveCount(0);
  await expect(faces.getByRole('button', { name: 'Tomato' })).toHaveAttribute('aria-pressed', 'true');
  await faces.getByRole('button', { name: 'Tamagotchi' }).click();
  await expect(page.locator('svg.tama')).toHaveCount(1);
  await expect(page.locator('svg.tomato')).toHaveCount(0);
  await expect(page.getByRole('timer')).toHaveText('25:00');
});

test('tomato dial turns to the minutes remaining', async ({ page }) => {
  const seed = focusInProgress(0);
  seed.timer = { ...seed.timer, status: 'paused', endsAt: null, remainingMs: 10 * MIN };
  await open(page, { data: seed, settings: { clockFace: 'tomato' } });
  await page.waitForTimeout(1300); // let the refill animation settle
  const t = await page.locator('.tomato-dial').getAttribute('transform');
  const angle = Number(t!.match(/rotate\((-?[\d.]+)/)![1]);
  expect(angle).toBeCloseTo(-60, 0); // 10 min × 6°
});

test('tamagotchi starts as an egg, hatches on the first pomodoro, grows up at ten', async ({ page }) => {
  await open(page, { settings: { clockFace: 'tamagotchi' } });
  const tama = page.locator('svg.tama');
  await expect(tama).toHaveAttribute('data-stage', 'egg');

  const seed = focusInProgress(0);
  seed.timer.endsAt = Date.now() + 1500;
  await page.evaluate((d) => localStorage.setItem('pomo:v1:data', JSON.stringify(d)), seed);
  await page.reload();
  await expect(tama).toHaveAttribute('data-stage', 'baby', { timeout: 5000 });
  await expect(tama).toHaveAttribute('data-mood', 'happy');
  expect((await stored(page)).history).toHaveLength(1);

  await open(page, { data: { ...focusInProgress(0), history: history(10) }, settings: { clockFace: 'tamagotchi' } });
  await expect(tama).toHaveAttribute('data-stage', 'adult');
  await expect(tama).toHaveAttribute('data-mood', 'working');
});

test('tamagotchi sleeps on a long break', async ({ page }) => {
  const seed = { ...focusInProgress(0), history: history(3) };
  seed.timer = { ...seed.timer, mode: 'long', status: 'idle', endsAt: null, remainingMs: 15 * MIN };
  await open(page, { data: seed, settings: { clockFace: 'tamagotchi' } });
  await expect(page.locator('svg.tama')).toHaveAttribute('data-mood', 'sleeping');
});
