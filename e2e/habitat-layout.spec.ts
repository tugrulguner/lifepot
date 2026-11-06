import { expect, test } from "@playwright/test";

for (const viewport of [{ width: 1280, height: 633 }, { width: 390, height: 850 }, { width: 320, height: 850 }]) {
  for (const theme of ["light", "dark"]) test(`fixed habitat controls preserve board and theme at ${viewport.width}px ${theme}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto("/play");
    await page.getByRole("combobox", { name: "Color theme" }).selectOption(theme);
    await page.getByRole("button", { name: "Explore deterministic preset" }).click();
    await page.getByLabel("World policy", { exact: true }).selectOption("fixed");
    await page.getByRole("checkbox", { name: "Enable same-world save and continuation" }).check();
    await page.getByRole("button", { name: /Seed ecosystem/ }).click();
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page.getByRole("button", { name: "Inspect a living organism", exact: true }).click();
    await page.getByRole("region", { name: "Creature inspector" }).getByRole("button", { name: /Follow founder lineage/ }).click();
    const geometry = await page.evaluate(() => {
      const board = document.querySelector("canvas.life-canvas")!.getBoundingClientRect();
      return { width: board.width, height: board.height, bottom: board.bottom, overflow: document.documentElement.scrollWidth > innerWidth };
    });
    expect(geometry.overflow).toBe(false);
    expect(geometry.width).toBeGreaterThanOrEqual(viewport.width <= 390 ? viewport.width - 40 : 300);
    expect(geometry.height).toBeGreaterThanOrEqual(viewport.width <= 390 ? 260 : 300);
    expect(geometry.bottom).toBeLessThanOrEqual(viewport.height - 12);
    const shelf = page.getByRole("region", { name: "Saved habitats — fixed-habitat checkpoints" });
    const continuity = page.getByRole("region", { name: "Habitat continuity" });
    const color = await continuity.evaluate(node => getComputedStyle(node).color);
    await expect(shelf).toHaveCSS("color", color);
    for (const button of [page.getByRole("button", { name: "Pause and save habitat" }), page.getByRole("button", { name: /^Extend observation/ }), shelf.getByRole("button", { name: "Import habitat backup" })]) {
      await button.scrollIntoViewIfNeeded();
      const bounds = await button.boundingBox();
      expect(bounds!.height).toBeGreaterThanOrEqual(44);
      expect(bounds!.width).toBeGreaterThanOrEqual(44);
      expect(await button.evaluate(node => { const r = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); })).toBe(true);
      await button.focus();
      await expect(button).toBeFocused();
    }
    await page.locator("canvas.life-canvas").scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`habitat-${viewport.width}-${theme}.png`), fullPage: true });
  });
}
