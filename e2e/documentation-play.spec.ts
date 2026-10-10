import { expect, test } from "@playwright/test";

for (const width of [1280, 768, 390, 320]) {
  test(`documentation contains an immediate primary Play action at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 850 });
    let judgeCalls = 0;
    await page.route("**/api/judge", route => { judgeCalls++; return route.abort(); });
    for (const theme of ["light", "dark", "auto"]) {
      await page.goto("/learn");
      await page.getByLabel("Theme").selectOption(theme);
      const play = page.locator(".learn-intro").getByRole("link", { name: "Play the game", exact: true });
      await expect(play).toHaveAttribute("href", "/play");
      await expect(page.getByRole("heading", { name: "LifePot documentation", exact: true })).toBeVisible();
      await expect(play).toHaveClass(/overview-primary/);
      await expect(play).toBeInViewport();
      const box = await play.boundingBox();
      expect(box!.y).toBeGreaterThanOrEqual(64);
      expect(box!.y + box!.height).toBeLessThanOrEqual(850);
      expect(await page.evaluate(() => scrollY)).toBe(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page.locator('a[href="/learn/quick-start"]').first()).toBeVisible();
      await page.screenshot({ path: info.outputPath(`documentation-${width}-${theme}.png`) });
      await play.click();
      await expect(page).toHaveURL(/\/play$/);
      await expect(page.getByRole("button", { name: "Explore deterministic preset", exact: true })).toBeVisible();
    }
    expect(judgeCalls).toBe(0);
  });
}
