import { expect, test } from '@playwright/test';

for (const width of [320, 390]) test(`the example puts the habitat before optional tools at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 });
  await page.route('**/api/**', route => route.abort());
  await page.goto('/play/example');
  const board = page.locator('canvas.life-canvas');
  await expect(board).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const rect = (await board.boundingBox())!;
  expect(rect.y).toBeLessThan(280);
  expect(rect.width).toBeGreaterThanOrEqual(width - 24);
  const options = page.getByRole('button', { name: 'View options', exact: true });
  const closeUp = page.getByRole('button', { name: 'Close-up view' });
  await expect(page.getByRole('group', { name: 'Watching progress' })).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeInViewport();
  await expect(closeUp).toBeHidden();
  await options.focus();
  await options.press('Enter');
  await expect(options).toHaveAttribute('aria-expanded', 'true');
  await expect(closeUp).toBeVisible();
  await expect(page.getByLabel('Configured species counts')).toBeVisible();
  await options.press('Space');
  await expect(options).toBeFocused();
  await expect(closeUp).toBeHidden();
  await expect(page.getByLabel('Configured species counts')).toBeHidden();
});
