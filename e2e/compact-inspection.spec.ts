import { expect, test } from "@playwright/test";

for (const width of [1280, 390, 320]) test(`species controls stay beside the board during compact and expanded inspection at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 850 });
  await page.route("**/api/judge", route => route.abort());
  await page.goto("/play");
  await page.getByRole("button", { name: "Explore deterministic preset" }).click();
  await page.getByRole("button", { name: /Seed ecosystem/ }).click();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Inspect living organism", exact: true }).click();
  const inspector = page.getByRole("region", { name: "Creature inspector" });
  const detail = inspector.locator("details.organism-details");
  await expect(detail).not.toHaveAttribute("open");
  await expect(inspector.getByRole("button", { name: /Follow founder lineage/ })).toBeVisible();
  const generation = await page.getByTestId("generation").textContent();
  for (const expanded of [false, true]) {
    if (expanded) await inspector.getByText("Detailed organism inspection", { exact: true }).click();
    if (expanded) await expect(detail).toHaveAttribute("open", "");
    const geometry = await page.evaluate(() => {
      const board = document.querySelector("canvas.life-canvas")!.getBoundingClientRect();
      const controls = document.querySelector(".species-focus-buttons")!.getBoundingClientRect();
      const inspector = document.querySelector("#creature-inspector")!.getBoundingClientRect();
      return { gap: controls.top - board.bottom, controlsBottom: controls.bottom, inspectorTop: inspector.top };
    });
    expect(geometry.gap).toBeGreaterThanOrEqual(0);
    expect(geometry.gap).toBeLessThanOrEqual(24);
    expect(geometry.controlsBottom).toBeLessThanOrEqual(geometry.inspectorTop);
    await page.getByRole("button", { name: "Focus species B", exact: true }).click();
    await expect(page.getByRole("button", { name: "Focus species B", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("generation")).toHaveText(generation!);
  }
  await inspector.getByRole("button", { name: /Follow founder lineage/ }).click();
  await inspector.getByRole("button", { name: "Clear inspection" }).click();
  await expect(inspector.getByRole("status")).toContainText("Following founder lineage");
  await expect(page.getByTestId("generation")).toHaveText(generation!);
});
