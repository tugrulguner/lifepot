import { expect, test } from '@playwright/test';

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
  } else {
    expect(text.y + text.height).toBeLessThanOrEqual(board.y);
    expect(board.width).toBeGreaterThanOrEqual(280);
  }
});
