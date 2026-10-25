import { expect, test, type Page } from "@playwright/test";

async function startFollowing(page: Page) {
  await page.setViewportSize({ width: 390, height: 850 });
  await page.route("**/api/judge", route => route.abort());
  await page.goto("/play");
  await page.locator('input[type="file"]').setInputFiles("e2e/fixtures/my-worlds/pond-notebook.json");
  await page.getByRole("button", { name: "Reopen and replay", exact: true }).click();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Inspect living organism", exact: true }).click();
  await page.getByRole("button", { name: "Pin this family", exact: true }).click();
  await page.getByRole("button", { name: "Follow pinned family with camera", exact: true }).click();
}

test("mobile watch view keeps the habitat and camera controls useful as real extinction notices grow", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "warning" && /ResizeObserver loop/i.test(message.text())) errors.push(message.text()); });
  await startFollowing(page);
  const initial = Number((await page.getByTestId("generation").textContent())!.match(/^(\d+)/)![1]);
  expect(initial).toBeLessThan(90);
  const step = page.getByRole("button", { name: "Step one generation", exact: true });
  await step.click({ trial: true });
  const stepControl = await step.elementHandle();
  if (!stepControl) throw new Error("Missing step control");
  for (let generation = initial; generation < 90; generation++) {
    await stepControl.evaluate(button => {
      if (!(button instanceof HTMLButtonElement) || !button.isConnected || button.disabled) throw new Error("Step control became unavailable");
      button.click();
    });
  }
  await expect(page.getByTestId("generation")).toHaveText("90 / 180");
  const matchedGeneration = await page.getByTestId("generation").textContent();
  await expect(page.locator("[aria-label='Latest retained extinction']")).toBeVisible();
  await expect(page.locator("[aria-label='Latest retained extinction']")).toContainText("extinct");
  await expect(page.locator("[aria-label='Camera update']")).toContainText("Full world restored.");
  const canvas = page.locator("canvas.life-canvas");
  const tools = page.getByRole("region", { name: "World camera", exact: true });
  await page.screenshot({ path: testInfo.outputPath(`watching-growing-notices-${matchedGeneration?.replaceAll(" / ", "-")}.png`), fullPage: true });
  await testInfo.attach("watching geometry", { body: JSON.stringify(await page.evaluate(() => ({ board: document.querySelector("canvas.life-canvas")!.getBoundingClientRect().toJSON(), camera: document.querySelector(".camera-tools")!.getBoundingClientRect().toJSON() }))), contentType: "application/json" });
  await expect.poll(() => page.evaluate(() => {
    const board = document.querySelector("canvas.life-canvas")!.getBoundingClientRect();
    const camera = document.querySelector(".camera-tools")!.getBoundingClientRect();
    return board.width >= 280 && camera.top >= board.bottom && camera.top - board.bottom < 24;
  })).toBe(true);
  await expect(tools.getByRole("button", { name: "Zoom in", exact: true })).toBeVisible();
  await expect(tools.getByRole("button", { name: "Full world", exact: true })).toBeVisible();
  await expect(tools.getByRole("button", { name: "Follow pinned family with camera", exact: true })).toBeVisible();
  expect(await tools.locator("button").evaluateAll(buttons => buttons.every(button => { const rect = button.getBoundingClientRect(); return rect.width >= 44 && rect.height >= 44; }))).toBe(true);
  await expect(tools.getByRole("button", { name: "Full world", exact: true })).toHaveCSS("min-height", "44px");
  await expect(page.getByRole("region", { name: "Recorded highlights", exact: true })).toBeVisible();
  await expect(canvas).toHaveAttribute("aria-label", /; [1-9]\d* organisms$/);
  expect(errors).toEqual([]);
});
