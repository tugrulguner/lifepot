import { expect, test } from '@playwright/test';

for (const width of [600, 601, 768, 1000, 1001]) {
  test(`world overview visibly expands and collapses at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.route('**/api/**', route => route.abort());
    await page.goto('/play/example');
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    const overview = page.getByRole('complementary', { name: 'World overview' });
    const mapWidth = () => overview.locator('canvas').evaluate(canvas => canvas.getBoundingClientRect().width);
    const collapsed = await mapWidth();
    expect(collapsed).toBeGreaterThan(0);
    await overview.getByRole('button', { name: 'Expand world overview' }).click();
    expect(await mapWidth()).toBeGreaterThanOrEqual(collapsed * 1.25);
    await overview.getByRole('button', { name: 'Collapse world overview' }).click();
    expect(await mapWidth()).toBe(collapsed);
  });
}
