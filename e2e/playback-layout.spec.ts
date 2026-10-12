import { expect, test } from "@playwright/test";

test("recorded replay restart label keeps mobile controls compact", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 850 });
  await page.goto("/play");
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.locator('input[type="file"]').setInputFiles("e2e/fixtures/my-worlds/pond-notebook.json");
  await page.getByRole("button", { name: "Reopen and replay" }).click();
  for (const paused of [true, false]) {
    await page.getByRole("button", { name: paused ? "Pause" : "Resume", exact: true }).click();
    await page.clock.runFor(32);
    const controls = page.locator(".controls");
    await expect.poll(async () => (await controls.boundingBox())!.height).toBeLessThanOrEqual(90);
    const board = (await page.locator("canvas.life-canvas").boundingBox())!;
    expect(board.width).toBeGreaterThanOrEqual(330);
    expect(board.y + board.height).toBeLessThanOrEqual(838);
    await expect(page.getByRole("button", { name: "Restart replay", exact: true })).toBeVisible();
  }
});

for (const viewport of [{ width: 768, height: 850 }, { width: 390, height: 850 }]) {
  test(`speed choices preserve useful board space and all controls at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    let inferenceCalls = 0;
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/api/judge", route => { inferenceCalls++; return route.abort(); });
    await page.goto("/play");
    await page.clock.install();
    await page.clock.pauseAt(new Date(Date.now() + 1000));
    await page.getByRole("button", { name: "Explore deterministic preset" }).click();
    await page.getByLabel("World policy").selectOption("fixed");
    await page.getByRole("button", { name: /Seed ecosystem/ }).click();
    const speed = page.getByRole("combobox", { name: "Playback speed" });
    const minimumBoard = viewport.width === 390 ? 350 : 300;
    for (const choice of ["slow", "normal", "fast"]) {
      await speed.selectOption(choice);
      for (const paused of [true, false]) {
        await page.getByRole("button", { name: paused ? "Pause" : "Resume", exact: true }).click();
        // Commit responsive layout without reaching even Fast's initial 450ms tick.
        await page.clock.runFor(32);
        await expect.poll(async () => (await page.locator("canvas.life-canvas").boundingBox())!.width).toBeGreaterThanOrEqual(minimumBoard);
        const board = (await page.locator("canvas.life-canvas").boundingBox())!;
        expect(board.y + board.height).toBeLessThanOrEqual(viewport.height - 12);
        const controls = await page.locator(".controls button, .controls select").evaluateAll(elements => elements.map(element => {
          const r = element.getBoundingClientRect();
          return { height: r.height, width: r.width, clear: element.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)) };
        }));
        expect(controls).toHaveLength(6);
        for (const control of controls) {
          expect(control.height).toBeGreaterThanOrEqual(44);
          expect(control.width).toBeGreaterThanOrEqual(44);
          expect(control.clear).toBe(true);
        }
      }
    }
    expect(inferenceCalls).toBe(0);
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
