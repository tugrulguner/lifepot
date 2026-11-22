import { expect, test } from "@playwright/test";

for (const width of [1280, 390, 320]) {
  test(`learning resources stay in progressive disclosure and open the index at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 850 });
    await page.goto("/");
    const docs = page.locator(".home-reference").locator("summary");
    await expect(page.locator(".overview-actions .overview-primary")).toBeInViewport();
    await expect(docs).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 1280) {
      await expect(page.locator(".family-header").getByRole("link", { name: "Documentation", exact: true })).toBeVisible();
    } else {
      await page.getByRole("button", { name: "Menu", exact: true }).click();
      await expect(page.getByRole("region", { name: "Menu" }).getByRole("link", { name: "Documentation", exact: true })).toHaveAttribute("href", "/learn");
      await page.keyboard.press("Escape");
    }
    await page.screenshot({ path: testInfo.outputPath(`overview-docs-${width}.png`), fullPage: true });
    await docs.click();
    await page.getByRole("link", { name: "All learning guides" }).click();
    await expect(page).toHaveURL(/\/learn$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    for (const slug of ["quick-start", "setup-and-review", "contracts", "engine-internals"]) {
      await expect(page.locator(`a[href="/learn/${slug}"]`).first()).toBeVisible();
    }
    await page.screenshot({ path: testInfo.outputPath(`learning-index-${width}.png`), fullPage: true });
  });
}
