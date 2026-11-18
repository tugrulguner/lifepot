import { expect, test, type Page } from "@playwright/test";

async function startFollowing(page: Page) {
  await page.setViewportSize({ width: 390, height: 850 });
  await page.route("**/api/judge", route => route.abort());
  await page.goto("/play");
  await page.getByLabel("Import a LifePot world export", { exact: true }).setInputFiles("e2e/fixtures/my-worlds/pond-notebook.json");
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
  // Keep native stepping and each rendered-generation check in the browser,
  // avoiding a protocol round trip and assertion polling delay on every tick.
  const observed = await stepControl.evaluate(async (button, initialGeneration) => {
    const board = () => {
      const canvas = document.querySelector("canvas.life-canvas");
      if (!canvas) throw new Error("Missing habitat canvas");
      return canvas;
    };
    const view = () => ["zoom", "x", "y"].map(key => board().getAttribute(`data-camera-${key}`));
    const progress: string[] = [];
    const losses: { before: (string | null)[]; after: (string | null)[] }[] = [];
    for (let generation = initialGeneration; generation < 90; generation++) {
      const wasFollowing = board().getAttribute("data-camera-follow");
      const priorView = view();
      if (!(button instanceof HTMLButtonElement) || !button.isConnected || button.disabled) throw new Error("Step control became unavailable");
      button.click();
      const expected = `${generation + 1} / 180`;
      const deadline = performance.now() + 5000;
      let rendered: string | null | undefined;
      do {
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        rendered = document.querySelector('[data-testid="generation"]')?.textContent;
        if (performance.now() > deadline) throw new Error(`Generation did not settle: expected ${expected}, received ${rendered}`);
      } while (rendered !== expected);
      progress.push(rendered);
      if (wasFollowing === "family" && board().getAttribute("data-camera-follow") === "none") {
        losses.push({ before: priorView, after: view() });
      }
    }
    return { progress, losses };
  }, initial);
  expect(observed.progress).toEqual(Array.from({ length: 90 - initial }, (_, index) => `${initial + index + 1} / 180`));
  expect(observed.losses.length).toBeGreaterThan(0);
  for (const loss of observed.losses) expect(loss.after).toEqual(loss.before);
  await expect(page.getByTestId("generation")).toHaveText("90 / 180");
  const matchedGeneration = await page.getByTestId("generation").textContent();
  await expect(page.locator("[aria-label='Latest retained extinction']")).toBeVisible();
  await expect(page.locator("[aria-label='Latest retained extinction']")).toContainText("extinct");
  await expect(page.locator("[aria-label='Camera update']")).toContainText("Last camera position retained.");
  const canvas = page.locator("canvas.life-canvas");
  const tools = page.getByRole("region", { name: "World camera", exact: true });
  await page.screenshot({ path: testInfo.outputPath(`watching-growing-notices-${matchedGeneration?.replaceAll(" / ", "-")}.png`), fullPage: true });
  await testInfo.attach("watching geometry", { body: JSON.stringify(await page.evaluate(() => ({ board: document.querySelector("canvas.life-canvas")!.getBoundingClientRect().toJSON(), camera: document.querySelector(".camera-tools")!.getBoundingClientRect().toJSON() }))), contentType: "application/json" });
  await expect.poll(() => canvas.evaluate(board => board.getBoundingClientRect().width)).toBeGreaterThanOrEqual(280);
  await expect.poll(() => page.evaluate(() => document.querySelector("canvas.life-canvas")!.getBoundingClientRect().top - document.querySelector(".camera-primary")!.getBoundingClientRect().bottom)).toBeGreaterThanOrEqual(0);
  await expect.poll(() => page.evaluate(() => document.querySelector("canvas.life-canvas")!.getBoundingClientRect().top - document.querySelector(".camera-primary")!.getBoundingClientRect().bottom)).toBeLessThan(24);
  await expect(tools.getByRole("button", { name: "Zoom in", exact: true })).toBeVisible();
  await expect(tools.getByRole("button", { name: "Full world", exact: true })).toBeVisible();
  await expect(tools.getByRole("button", { name: "Follow pinned family with camera", exact: true })).toBeVisible();
  expect(await tools.locator("button").evaluateAll(buttons => buttons.every(button => { const rect = button.getBoundingClientRect(); return rect.width >= 44 && rect.height >= 44; }))).toBe(true);
  await expect(tools.getByRole("button", { name: "Full world", exact: true })).toHaveCSS("min-height", "44px");
  await expect(page.getByRole("region", { name: "Recorded highlights", exact: true })).toBeVisible();
  await expect(canvas).toHaveAttribute("aria-label", /; [1-9]\d* organisms$/);
  expect(errors).toEqual([]);
});
