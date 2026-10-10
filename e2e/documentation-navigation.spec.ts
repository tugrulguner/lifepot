import { expect, test } from "@playwright/test";
import { guideMarkdown, guides } from "../src/app/learn/content";

test("all task-first documentation pages and downloads use the same canonical content", async ({ page, request }) => {
  for (const guide of guides) {
    const response = await page.goto(`/learn/${guide.slug}`);
    expect(response?.status(), guide.slug).toBe(200);
    await expect(page.locator(".learn-prose h1")).toHaveCount(1);
    await expect(page.getByRole("navigation", { name: "Documentation navigation" })).toBeVisible();
    await expect(page.locator(`[aria-current="page"][href="/learn/${guide.slug}"]`)).toBeVisible();
    const download = await request.get(`/learn/${guide.slug}/markdown`);
    expect(download.ok()).toBe(true);
    expect(await download.text()).toBe(guideMarkdown(guide.slug));
    for (const link of await page.locator('.learn-prose a[href^="/learn/"]').evaluateAll(links => links.map(link => link.getAttribute("href")!))) {
      expect((await request.get(link)).ok(), link).toBe(true);
    }
  }
});

test("overview has first-fold Play and preserves the keyless game entry across themes and viewports", async ({ page }, info) => {
  test.setTimeout(90_000);
  await page.route("**/api/judge**", route => route.abort());
  for (const width of [1280, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 850 });
    for (const theme of ["light", "dark", "auto"]) {
      await page.goto("/");
      await page.getByLabel("Color theme").selectOption(theme);
      const play = page.locator(".overview-actions").getByRole("link", { name: "Play the game" });
      await expect(play).toHaveAttribute("href", "/play");
      const box = await play.boundingBox();
      expect(box && box.y >= 0 && box.y + box.height < 850).toBe(true);
      const architecture = page.locator('.overview-mechanism img');
      await expect.poll(() => architecture.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: info.outputPath(`overview-${width}-${theme}.png`), fullPage: true });
      await play.click();
      await expect(page).toHaveURL(/\/play$/);
      await expect(page.getByRole("button", { name: "Explore deterministic preset" })).toBeVisible();
    }
    await page.goto("/learn/contracts");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`contracts-${width}.png`), fullPage: true });
  }
});
