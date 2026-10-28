import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

for (const width of [1280, 390]) {
  test(`the habitat leads extended measurements at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 850 });
    let inference = 0;
    await page.route("**/api/**", route => { inference++; return route.abort(); });
    await page.goto("/play");
    await page.getByRole("button", { name: "Explore deterministic preset" }).click();
    await page.getByLabel("World policy", { exact: true }).selectOption("fixed");
    await page.getByRole("button", { name: /Seed ecosystem/ }).click();
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page.evaluate(async () => { await document.fonts.ready; await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))); });
    const geometry = await page.evaluate(() => {
      const rect = (selector: string) => document.querySelector(selector)!.getBoundingClientRect().toJSON();
      return { board: rect("canvas.life-canvas"), stats: rect(".stats-strip"), header: rect(".family-header"), scrollY, overflow: document.documentElement.scrollWidth > innerWidth };
    });
    mkdirSync(testInfo.outputDir, { recursive: true });
    writeFileSync(testInfo.outputPath("watching-layout.json"), JSON.stringify(geometry, null, 2));
    await page.screenshot({ path: testInfo.outputPath("watching-layout.png") });
    expect(geometry.stats.y, "extended measurements must not displace the living habitat").toBeGreaterThanOrEqual(geometry.board.bottom);
    expect(geometry.board.width).toBeGreaterThanOrEqual(width > 1000 ? 600 : 340);
    expect(geometry.board.y).toBeGreaterThanOrEqual(geometry.header.bottom);
    expect(geometry.board.bottom).toBeLessThanOrEqual(838);
    expect(geometry.scrollY).toBe(0);
    expect(geometry.overflow).toBe(false);
    if (width === 390) {
      const cameraButtons = await page.locator(".camera-primary .camera-buttons").boundingBox();
      expect(cameraButtons!.height, "camera actions fit one row without orphaned options").toBeLessThanOrEqual(48);
    }
    await expect(page.getByRole("region", { name: "Live ecosystem statistics" })).toContainText("Living variants");
    expect(inference).toBe(0);
  });
}

for (const width of [1280, 390, 320]) {
  test(`close-up and family guidance are discoverable at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 850 });
    let inference = 0;
    await page.route("**/api/**", route => { inference++; return route.abort(); });
    await page.goto("/play");
    await page.getByRole("button", { name: "Explore deterministic preset" }).click();
    await page.getByLabel("World policy", { exact: true }).selectOption("fixed");
    await page.getByRole("button", { name: /Seed ecosystem/ }).click();
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    const camera = page.getByRole("region", { name: "World camera", exact: true });
    const closeUp = camera.getByRole("button", { name: "Close-up view", exact: true });
    await expect(closeUp).toBeInViewport();
    await expect(camera).toContainText("pin its family");
    const measurementsLink = camera.getByRole("link", { name: "Measurements", exact: true });
    await expect(measurementsLink).toBeInViewport();
    const generation = await page.getByTestId("generation").textContent();
    const measurements = await page.getByRole("region", { name: "Live ecosystem statistics" }).textContent();
    await expect(camera.getByRole("group", { name: "Watching progress" })).toContainText(generation!);
    await closeUp.click();
    const board = page.locator("canvas.life-canvas");
    await expect(board).toHaveAttribute("data-camera-zoom", "2");
    await expect(page.getByTestId("generation")).toHaveText(generation!);
    expect(await page.getByRole("region", { name: "Live ecosystem statistics" }).textContent()).toBe(measurements);
    await page.getByRole("button", { name: "Inspect living organism", exact: true }).click();
    await page.getByRole("button", { name: "Pin this family", exact: true }).click();
    await expect(camera).toContainText("Follow family keeps it in view");
    await camera.getByRole("button", { name: "Follow pinned family with camera" }).click();
    await expect(board).toHaveAttribute("data-camera-follow", "family");
    await camera.getByRole("button", { name: "Full world", exact: true }).click();
    await expect(board).toHaveAttribute("data-camera-zoom", "1");
    await expect(board).toHaveAttribute("data-camera-follow", "none");
    await expect(page.getByTestId("generation")).toHaveText(generation!);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    mkdirSync(testInfo.outputDir, { recursive: true });
    await page.screenshot({ path: testInfo.outputPath("discoverable-camera.png") });
    expect(inference).toBe(0);
  });
}
