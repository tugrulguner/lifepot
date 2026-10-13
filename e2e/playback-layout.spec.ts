import { expect, test } from "@playwright/test";

for (const width of [375, 390]) {
  test(`recorded replay controls stay compact and usable at ${width}px${width === 390 ? " with a classic scrollbar" : ""}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.goto("/play");
    if (width === 390) {
      await page.addStyleTag({ content: "body { margin-right: 15px !important; }" });
    }
    await page.clock.install();
    await page.clock.pauseAt(new Date(Date.now() + 1000));
    await page.locator('input[type="file"]').setInputFiles("e2e/fixtures/my-worlds/pond-notebook.json");
    await page.getByRole("button", { name: "Reopen and replay" }).click();
    if (width === 390) {
      await expect.poll(() => page.evaluate(() => ({ innerWidth, contentWidth: document.querySelector(".simulation-shell")!.clientWidth }))).toEqual({ innerWidth: 390, contentWidth: 375 });
    }

    const speed = page.getByRole("combobox", { name: "Playback speed" });
    for (const choice of ["slow", "normal", "fast"]) {
      await speed.selectOption(choice);
      for (const paused of [true, false]) {
        await page.getByRole("button", { name: paused ? "Pause" : "Resume", exact: true }).click();
        await page.clock.runFor(32);
        const controls = page.locator(".controls");
        await expect.poll(async () => (await controls.boundingBox())!.height).toBeLessThanOrEqual(90);
        const board = (await page.locator("canvas.life-canvas").boundingBox())!;
        expect(board.width).toBeGreaterThanOrEqual(330);
        expect(board.y + board.height).toBeLessThanOrEqual(838);
        await expect(page.getByRole("button", { name: "Restart replay", exact: true })).toBeVisible();
        const targets = await page.locator(".controls button, .controls select").evaluateAll(elements => elements.map(element => {
          const r = element.getBoundingClientRect();
          return { height: r.height, width: r.width, clear: element.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)) };
        }));
        expect(targets).toHaveLength(6);
        for (const target of targets) {
          expect(target.height).toBeGreaterThanOrEqual(44);
          expect(target.width).toBeGreaterThanOrEqual(44);
          expect(target.clear).toBe(true);
        }
      }
    }

    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page.getByRole("button", { name: "Restart replay", exact: true }).click();
    await expect(page.getByRole("button", { name: "Restart replay", exact: true })).toBeVisible();
    expect(await page.getByTestId("generation").textContent()).toMatch(/^0 \/ /);
  });
}

for (const viewport of [
  { width: 320, height: 850 },
  { width: 375, height: 850 },
  { width: 390, height: 850 },
  { width: 768, height: 850 },
  { width: 1280, height: 850 },
  { width: 1280, height: 633 },
]) {
  test(`preset speeds preserve board fit and usable controls at ${viewport.width}x${viewport.height}`, async ({ page }) => {
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
    const minimumBoard = viewport.width === 320 ? 0 : viewport.width === 375 ? 330 : viewport.width === 390 ? 350 : 300;
    for (const choice of ["slow", "normal", "fast"]) {
      await speed.selectOption(choice);
      for (const paused of [true, false]) {
        await page.getByRole("button", { name: paused ? "Pause" : "Resume", exact: true }).click();
        // Commit responsive layout without reaching even Fast's initial 450ms tick.
        await page.clock.runFor(32);
        const board = (await page.locator("canvas.life-canvas").boundingBox())!;
        if (minimumBoard > 0) expect(board.width).toBeGreaterThanOrEqual(minimumBoard);
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
