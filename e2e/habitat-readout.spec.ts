import { expect, test } from '@playwright/test';

for (const width of [1001, 1280]) for (const expanded of [false, true]) test(`opened habitat detail does not cover World Legend at ${width}px overview ${expanded ? 'expanded' : 'collapsed'}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.route('**/api/**', route => route.abort());
  await page.goto('/experiment');
  for (const name of ['Use a starter world instead', 'Review this world', 'Seed ecosystem']) await page.getByRole('button', { name: new RegExp(name) }).click();
  await page.getByLabel('Playback speed', { exact: true }).selectOption('normal');
  const overview = page.getByRole('complementary', { name: 'World overview' });
  if (expanded) await page.getByRole('button', { name: 'Expand world overview' }).click();
  const detail = page.getByRole('note', { name: 'Habitat readout' });
  await detail.locator('summary').click();
  const legend = page.locator('.configured-species-counts');
  await expect(legend).toBeVisible();
  const detailBox = (await detail.boundingBox())!;
  const legendBox = (await legend.boundingBox())!;
  const overlap = Math.max(0, Math.min(detailBox.x + detailBox.width, legendBox.x + legendBox.width) - Math.max(detailBox.x, legendBox.x))
    * Math.max(0, Math.min(detailBox.y + detailBox.height, legendBox.y + legendBox.height) - Math.max(detailBox.y, legendBox.y));
  expect(overlap, `detail=${JSON.stringify(detailBox)} legend=${JSON.stringify(legendBox)} overview=${JSON.stringify(await overview.boundingBox())}`).toBe(0);
  const hitTest = await page.evaluate(l => {
    let checked = 0;
    let intercepted = 0;
    for (let y = l.y + 2; y < l.y + l.height - 2; y += 4) for (let x = l.x + 2; x < l.x + l.width - 2; x += 4) {
      checked++;
      const hit = document.elementFromPoint(x, y);
      if (!hit?.closest('.configured-species-counts') || hit.closest('[aria-label="Habitat readout"]')) intercepted++;
    }
    return { checked, intercepted };
  }, legendBox);
  expect(hitTest.checked).toBeGreaterThan(0);
  expect(hitTest.intercepted, 'the open detail must not intercept World Legend hit points').toBe(0);
});

for (const width of [390, 1001, 1280]) test(`habitat readout stays visible with the board at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 800 });
  await page.route('**/api/**', route => route.abort());
  await page.goto('/experiment');
  for (const name of ['Use a starter world instead', 'Review this world', 'Seed ecosystem']) {
    await page.getByRole('button', { name: new RegExp(name) }).click();
  }
  await page.getByLabel('Playback speed', { exact: true }).selectOption('normal');
  const note = page.getByRole('note', { name: 'Habitat readout' });
  await expect(note).toHaveCount(1);
  await expect(note).toContainText('World food:');
  await expect(note).toBeInViewport({ ratio: 1 });
  const text = (await note.boundingBox())!;
  const board = (await page.locator('canvas.life-canvas').boundingBox())!;
  if (width > 1000) {
    expect(text.x).toBeGreaterThanOrEqual(board.x + board.width);
    const overview = (await page.getByRole('complementary', { name: 'World overview' }).boundingBox())!;
    expect(text.x + text.width).toBeLessThanOrEqual(overview.x);
    await page.getByRole('button', { name: 'Expand world overview' }).click();
    await expect.poll(async () => {
      const bounds = (await note.boundingBox())!;
      const expanded = (await page.getByRole('complementary', { name: 'World overview' }).boundingBox())!;
      return expanded.x - bounds.x - bounds.width;
    }).toBeGreaterThanOrEqual(0);
    await expect(note).toBeInViewport({ ratio: 1 });
  } else {
    expect(text.y).toBeGreaterThanOrEqual(board.y + board.height - 1);
    const filters = (await page.locator('.species-focus-buttons').boundingBox())!;
    expect(filters.y - board.y - board.height).toBeLessThanOrEqual(24);
    expect(text.y - filters.y - filters.height).toBeLessThan(40);
    expect(board.width).toBeGreaterThanOrEqual(280);
  }
  const why = note.locator('summary');
  await why.click();
  await expect(note.getByText(/Possible mechanism, not measured here:/)).toBeVisible();
  await why.press('Enter');
  await expect(note.locator('details')).not.toHaveAttribute('open', '');
});
