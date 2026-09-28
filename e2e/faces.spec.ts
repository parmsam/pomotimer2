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

test.describe('more faces', () => {
  const halfway = () => {
    const seed = focusInProgress(0);
    seed.timer = { ...seed.timer, status: 'paused', endsAt: null, remainingMs: 12.5 * MIN };
    return seed;
  };

  for (const [id, label, cls] of [
    ['hourglass', 'Hourglass', 'hourglass'],
    ['plant', 'Plant Buddy', 'plant'],
    ['enso', 'Zen Enso', 'enso'],
    ['handheld', 'Retro Handheld', 'handheld'],
    ['potion', 'Potion', 'potion'],
  ] as const) {
    test(`${label}: selectable, and shows progress halfway through a session`, async ({ page }) => {
      await open(page, { data: halfway() });
      await page.locator('#settings-open').click();
      await page.getByRole('group', { name: 'Clock face' }).getByRole('button', { name: label, exact: true }).click();
      await expect(page.locator('.dial')).toHaveAttribute('data-face', id);
      const art = page.locator(`svg.${cls}`);
      await expect(art).toHaveCount(1);
      const level = Number(await art.getAttribute('data-level'));
      expect(level).toBeGreaterThanOrEqual(45);
      expect(level).toBeLessThanOrEqual(55);
      await expect(page.getByRole('timer')).toHaveText('12:30');
    });
  }

  test('plant buddy is in bloom on a break', async ({ page }) => {
    const seed = focusInProgress(0);
    seed.timer = { ...seed.timer, mode: 'short', status: 'idle', endsAt: null, remainingMs: 5 * MIN };
    await open(page, { data: seed, settings: { clockFace: 'plant' } });
    await expect(page.locator('svg.plant')).toHaveAttribute('data-level', '100');
  });

  test('potion drains on a break (you drink it)', async ({ page }) => {
    const seed = focusInProgress(0);
    seed.timer = { ...seed.timer, mode: 'short', status: 'paused', endsAt: null, remainingMs: 1 * MIN };
    await open(page, { data: seed, settings: { clockFace: 'potion' } });
    await expect(page.locator('svg.potion')).toHaveAttribute('data-level', '20');
  });
});

test('captions stay inside the face (two lines) and show the full text on hover', async ({ page }) => {
  const long = 'Draft the quarterly report for the leadership offsite and send it to the team for review';
  const seed = { ...focusInProgress(0), tasks: [{ id: 'a', title: long, estimate: 1, pomodoros: 0, trackedMs: 0, done: false, createdAt: 0, doneAt: null }], activeTaskId: 'a' };
  seed.timer = { ...seed.timer, status: 'idle', endsAt: null };
  for (const face of ['ring', 'tomato', 'potion']) {
    await open(page, { data: seed, settings: { clockFace: face } });
    const sub = page.locator('#sub');
    await expect(sub).toHaveAttribute('title', new RegExp(long));
    const lineHeight = await sub.evaluate((el) => parseFloat(getComputedStyle(el).lineHeight));
    const box = (await sub.boundingBox())!;
    expect(box.height, face).toBeLessThanOrEqual(lineHeight * 2 + 2);
  }
});

test('the handheld shows its caption under the device', async ({ page }) => {
  const seed = focusInProgress(0);
  seed.timer = { ...seed.timer, mode: 'short', status: 'idle', endsAt: null, remainingMs: 5 * MIN };
  await open(page, { data: seed, settings: { clockFace: 'handheld' } });
  const sub = (await page.locator('#sub').boundingBox())!;
  const dial = (await page.locator('.dial').boundingBox())!;
  await expect(page.locator('#sub')).toBeVisible();
  expect(sub.y).toBeGreaterThanOrEqual(dial.y + dial.height - 2);
});
