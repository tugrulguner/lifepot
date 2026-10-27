import { test, expect } from '@playwright/test';
import { ENVIRONMENT_PRESSURES } from '../src/game/rules';

// Provider fixtures exercise native modal/keyboard ownership, not live inference.
const proposal = {
  version: 1, source: 'jev', model: 'focus-regression-fixture',
  usage: { input_tokens: 1, output_tokens: 1 }, pressure: 'nutrient_bloom', duration: 6,
  evidence: { choice: 'nutrient_bloom', confidence: 1, probabilities: Object.fromEntries(
    ['unsupported', ...ENVIRONMENT_PRESSURES].map(key => [key, key === 'nutrient_bloom' ? 1 : 0]),
  ) },
};

for (const width of [320, 390, 1280]) {
  for (const action of ['Escape', 'Close', 'Accept'] as const) {
    test(`proposal ${action} restores keyboard focus without scrolling at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 850 });
      await page.route('**/*posthog.com/**', route => route.abort());
      await page.route('**/api/judge', route => route.abort());
      await page.route('**/api/player-proposal', route => route.fulfill({ json: { outcome: 'proposed', proposal } }));
      await page.clock.install({ time: new Date('2026-10-26T02:00:00Z') });
      await page.clock.pauseAt(new Date('2026-10-26T02:00:01Z'));
      await page.goto('/play');
      await page.getByRole('button', { name: 'Explore deterministic preset' }).click();
      await page.getByRole('button', { name: /Seed ecosystem/ }).click();
      const opener = page.getByRole('button', { name: 'Ask Jev to change this world' });
      await opener.click();
      const dialog = page.getByRole('dialog', { name: 'Review a player-directed world change' });
      await expect(dialog).toBeVisible();
      const measurements = await page.locator('.stats-strip').innerText();
      if (action === 'Accept') {
        await page.getByRole('textbox', { name: 'Request a temporary world change' }).fill('Temporarily increase nutrients');
        await page.getByRole('button', { name: 'Ask Jev for a proposal' }).click();
        await expect(page.getByRole('button', { name: 'Accept this change' })).toBeVisible();
      }
      const scrollY = await page.evaluate(() => window.scrollY);
      if (action === 'Escape') await page.keyboard.press('Escape');
      else await page.getByRole('button', { name: action === 'Close' ? 'Close proposal' : 'Accept this change' }).click();
      await expect(dialog).toHaveCount(0);
      await page.clock.runFor(50); // Drain rendering; immediate focus checks can miss unmount cleanup.
      await expect(opener).toBeFocused();
      expect(Math.abs(await page.evaluate(() => window.scrollY) - scrollY)).toBeLessThanOrEqual(1);
      await expect(page.getByTestId('generation')).toHaveText('0 / 180');
      expect(await page.locator('.stats-strip').innerText()).toBe(measurements);
      await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeVisible();
      if (action === 'Accept') await expect(page.getByLabel('Player change status')).toContainText('Accepted');
    });
  }
}
