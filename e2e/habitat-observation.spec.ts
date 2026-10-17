import { expect, test, type Page } from "@playwright/test";

async function startPaused(page: Page) {
  await page.goto("/play");
  await page.getByRole("button", { name: "Explore deterministic preset", exact: true }).click();
  await page.getByLabel("World policy", { exact: true }).selectOption("fixed");
  await page.getByRole("button", { name: /Seed ecosystem/ }).click();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
}

test("short mobile habitat stays drawable when preceding content exceeds the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 390 });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/api/judge", route => route.abort());
  await startPaused(page);
  const board = page.locator("canvas.life-canvas");
  await expect.poll(() => board.evaluate(canvas => canvas.getBoundingClientRect().width)).toBeGreaterThanOrEqual(280);
  await page.getByRole("button", { name: "Inspect living organism", exact: true }).click();
  await expect.poll(() => board.evaluate(canvas => canvas.getBoundingClientRect().width)).toBeGreaterThanOrEqual(280);
  await board.scrollIntoViewIfNeeded();
  expect(await board.evaluate(canvas => {
    const c = canvas as HTMLCanvasElement, { data } = c.getContext("2d")!.getImageData(0, 0, c.width, c.height);
    let colored = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i] > 80 || data[i + 1] > 110 || data[i + 2] > 90) colored++;
    return colored;
  })).toBeGreaterThan(100);
  expect(errors).toEqual([]);
});

for (const viewport of [{ width: 1280, height: 850 }, { width: 1280, height: 633 }, { width: 390, height: 850 }]) {
  test(`inspection keeps the habitat and measured subject together at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/api/judge", route => route.abort());
    await startPaused(page);
    const generation = await page.getByTestId("generation").textContent();
    await page.getByRole("button", { name: "Inspect living organism", exact: true }).click();
    // No helper scroll: this is the actual action's arrival, not a repaired screenshot.
    await expect.poll(() => page.evaluate(() => {
      const board = document.querySelector("canvas.life-canvas")!.getBoundingClientRect();
      const header = document.querySelector(".family-header")!.getBoundingClientRect();
      return board.top >= header.bottom && board.bottom <= innerHeight - 12;
    })).toBe(true);
    const subject = page.getByRole("region", { name: "Watching organism", exact: true });
    await expect(subject).toBeInViewport();
    await expect(subject).toContainText(/Energy .+Age/);
    await expect(subject.getByRole("button", { name: "Pin this family", exact: true })).toBeVisible();
    await subject.getByRole("button", { name: "Pin this family", exact: true }).click();
    await expect(page.getByRole("region", { name: "Near-board observations" })).toContainText(/Following lineage/);
    await expect.poll(() => page.evaluate((minimum) => {
      const board = document.querySelector("canvas.life-canvas")!.getBoundingClientRect();
      const header = document.querySelector(".family-header")!.getBoundingClientRect();
      return board.width >= minimum && board.top >= header.bottom && board.bottom <= innerHeight - 12;
    }, viewport.width === 390 ? 330 : 300)).toBe(true);
    await expect(page.getByTestId("generation")).toHaveText(generation!);
    await page.screenshot({ path: testInfo.outputPath("habitat-and-subject.png") });
    // Detailed measurements are still available after a deliberate navigation action.
    await subject.getByRole("button", { name: "More organism details", exact: true }).click();
    await expect(page.getByRole("region", { name: "Creature inspector", exact: true })).toBeInViewport();
    expect(errors).toEqual([]);
  });
}

for (const width of [1280, 390]) test(`species focus keeps an inspected and pinned family bright at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 850 });
  await page.addInitScript(() => {
    const trace: Array<{ x: number; y: number; alpha: number }> = [];
    (window as unknown as { habitatPaint: typeof trace }).habitatPaint = trace;
    const originalFill = CanvasRenderingContext2D.prototype.fillRect;
    CanvasRenderingContext2D.prototype.fillRect = function(x, y, w, h) {
      if (this.canvas.matches("canvas.life-canvas") && x === 0 && y === 0) trace.length = 0;
      return originalFill.call(this, x, y, w, h);
    };
    const originalImage = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function(this: CanvasRenderingContext2D, ...args: unknown[]) {
      if (this.canvas.matches("canvas.life-canvas")) trace.push({ x: Number(args[1]), y: Number(args[2]), alpha: this.globalAlpha });
      return Reflect.apply(originalImage, this, args);
    };
  });
  await page.route("**/api/judge", route => route.abort());
  await startPaused(page);
  await page.getByRole("button", { name: "Inspect living organism", exact: true }).click();
  const inspector = page.getByRole("region", { name: "Creature inspector", exact: true });
  const text = await inspector.innerText();
  const species = text.match(/Species ([AB]) ·/)!;
  const position = text.match(/\((\d+), (\d+)\)/)!;
  expect(species).not.toBeNull(); expect(position).not.toBeNull();
  await page.getByRole("button", { name: `Focus species ${species[1] === "A" ? "B" : "A"}`, exact: true }).click();
  await page.getByRole("button", { name: "Follow organism with camera", exact: true }).click();
  const expectAlpha = (alpha: number) => expect.poll(() => page.evaluate(({ col, row }) => {
    const rect = document.querySelector("canvas.life-canvas")!.getBoundingClientRect();
    const pitch = (rect.width - 36) / 50;
    return (window as unknown as { habitatPaint: Array<{ x: number; y: number; alpha: number }> }).habitatPaint
      .find(item => Math.abs(item.x - (18 + col * pitch)) < .01 && Math.abs(item.y - (18 + row * pitch)) < .01)?.alpha;
  }, { col: Number(position[1]), row: Number(position[2]) })).toBe(alpha);
  await expectAlpha(1); // An inspected organism is visible even without a family pin.
  await inspector.getByRole("button", { name: /Follow founder lineage/ }).click();
  await inspector.getByRole("button", { name: "Clear inspection", exact: true }).click();
  await page.getByRole("button", { name: "Follow pinned family with camera", exact: true }).click();
  await expectAlpha(1); // Clearing inspection must not dim the independently pinned family.
  await inspector.getByRole("button", { name: "Stop following", exact: true }).click();
  await expectAlpha(.15); // The filter still de-emphasizes other, unpinned life.
});
