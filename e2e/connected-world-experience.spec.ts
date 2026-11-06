import { expect, test, type BrowserContext, type Page } from '@playwright/test';

// Functional acceleration only; full ordinary-speed sessions are retained separately.
for (const width of [390, 1280]) test.describe.serial(`${width}px habitat-to-outcome continuity`, () => {
  let context: BrowserContext, page: Page, family: string, requests = 0;
  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({ viewport: { width, height: 844 } });
    page = await context.newPage();
    await page.route('**/api/{judge,reflect,player-proposal}', route => { requests++; return route.abort(); });
  });
  test.afterAll(async () => { await context?.close(); });
  test('natural completion keeps the real final habitat in view', async () => {
    await page.goto('/play');
    await page.getByRole('button', { name: 'Review this world', exact: true }).click();
    await page.getByRole('button', { name: /Seed ecosystem/ }).click();
    await page.getByRole('button', { name: 'Inspect living organism', exact: true }).first().click();
    family = (await page.getByRole('button', { name: /Follow founder lineage/ }).innerText()).match(/#(\d+)/)![1];
    await page.getByRole('button', { name: 'Pin this family', exact: true }).click();
    await page.getByRole('combobox', { name: 'Playback speed' }).selectOption('fast');
    const originalBoard = await page.locator('.life-canvas').boundingBox();
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Run status' })).toContainText('Observation complete', { timeout: 30000 });
    await expect(page.getByTestId('generation')).toHaveText('180 / 180');
    const board = page.locator('.life-canvas');
    const bounds = await board.boundingBox();
    expect(bounds!.y, 'completion must not scroll the final habitat above the viewport').toBeGreaterThanOrEqual(0);
    expect(Math.min(844, bounds!.y + bounds!.height) - bounds!.y).toBeGreaterThan(bounds!.height * .8);
    await expect(page.getByRole('group', { name: 'Watching progress' })).toContainText('Observation complete');
    const outcome = page.getByRole('region', { name: 'World outcome', exact: true });
    await expect(outcome).toContainText(`Lineage #${family}`);
    await expect(outcome).toContainText('starting conditions');
    if (width === 1280) expect(bounds!.width, 'completion must retain the habitat scale').toBeGreaterThanOrEqual(originalBoard!.width * .95);
    const action = page.getByRole('button', { name: 'Investigate this outcome', exact: true });
    for (const theme of ['light', 'dark']) {
      await page.getByLabel('Color theme').selectOption(theme);
      const contrast = await action.evaluate(element => {
        const style = getComputedStyle(element);
        const luminance = (color: string) => color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
        const a = luminance(style.color), b = luminance(style.backgroundColor);
        return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
      });
      expect(contrast, `${theme} outcome action contrast`).toBeGreaterThanOrEqual(4.5);
    }
    expect(requests).toBe(0);
  });
  test('outcome inspection and a related follow-up preserve the world and evidence', async () => {
    const board = page.locator('.life-canvas');
    const identity = await board.getAttribute('aria-label');
    await page.getByRole('button', { name: 'Investigate this outcome', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Run results', exact: true })).toBeFocused();
    await expect(page.getByRole('status', { name: 'Followed lineage outcome', exact: true })).toContainText(`Lineage #${family}`);
    await page.getByRole('button', { name: 'Inspect final world', exact: true }).click();
    await expect(board).toBeFocused();
    await expect(board).toHaveAttribute('aria-label', identity!);
    await page.getByRole('button', { name: 'Review next trial', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Review your next experiment', exact: true })).toContainText(`lineage #${family}`);
    await expect(page.getByLabel('World policy', { exact: true })).toHaveValue('fixed');
    await page.locator('summary').filter({ hasText: 'Edit world conditions' }).click();
    await page.getByLabel('Resource abundance', { exact: true }).selectOption('rich');
    await page.getByRole('button', { name: /Seed ecosystem/ }).click();
    await expect(page.getByRole('region', { name: 'Run status' })).toContainText('Observation complete', { timeout: 30000 });
    await page.getByRole('button', { name: 'Investigate this outcome', exact: true }).click();
    const comparison = page.getByRole('region', { name: 'Previous trial comparison', exact: true });
    await expect(comparison).toContainText('Same initial seed: 241.');
    await expect(comparison).toContainText('rich');
    await expect(comparison).toContainText(`lineage #${family}`);
    expect(requests).toBe(0);
  });
});
