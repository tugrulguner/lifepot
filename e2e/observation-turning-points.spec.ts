import { expect, test, type Page } from "@playwright/test";

declare global { interface Window { turningPointAlphas: number[] } }

async function preset(page: Page, scarce = false) {
  await page.route("**/api/judge", route => route.abort());
  await page.goto("/play");
  await page.getByRole("button", { name: "Explore deterministic preset", exact: true }).click();
  if (scarce) {
    await page.getByText("Edit world conditions", { exact: true }).click();
    await page.getByLabel("Resource abundance", { exact: true }).selectOption("scarce");
  }
  await page.getByLabel("World policy", { exact: true }).selectOption("fixed");
  await page.getByRole("button", { name: /Seed ecosystem/ }).click();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
}

test("real mobile inspection layout settles without ResizeObserver errors", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 577 } });
  const page = await context.newPage();
  const protocol = await context.newCDPSession(page);
  // Match the mobile metrics and background-to-foreground transition observed
  // during the interactive review, rather than desktop narrow-width emulation.
  await protocol.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 850, deviceScaleFactor: 1, mobile: true });
  await protocol.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
  const spare = await context.newPage();
  await spare.bringToFront();
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  try {
    await preset(page);
    for (let i = 0; i < 3; i++) {
      await page.getByRole("button", { name: "Inspect living organism", exact: true }).click();
      await page.getByRole("button", { name: "Pin this family", exact: true }).click();
      await page.getByRole("button", { name: "Clear inspection", exact: true }).click();
      await page.getByRole("button", { name: "Follow pinned family with camera", exact: true }).click();
      await page.bringToFront();
      await protocol.send("Emulation.setDeviceMetricsOverride", { width: 390, height: i % 2 ? 850 : 800, deviceScaleFactor: 1, mobile: true });
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    }
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test("an extinct focus retains visible context without clearing the player's species choice", async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 390, height: 850 });
  await page.addInitScript(() => {
    window.turningPointAlphas = [];
    const fill = CanvasRenderingContext2D.prototype.fillRect;
    CanvasRenderingContext2D.prototype.fillRect = function(x, y, w, h) {
      if (this.canvas.matches("canvas.life-canvas") && x === 0 && y === 0) window.turningPointAlphas = [];
      return fill.call(this, x, y, w, h);
    };
    const image = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function(this: CanvasRenderingContext2D, ...args: unknown[]) {
      if (this.canvas.matches("canvas.life-canvas")) window.turningPointAlphas.push(this.globalAlpha);
      return Reflect.apply(image, this, args);
    };
  });
  await preset(page, true);
  await page.getByRole("button", { name: "Focus species B", exact: true }).click();
  const step = await page.getByRole("button", { name: "Step one generation", exact: true }).elementHandle();
  await step!.evaluate(async button => {
    for (let i = 0; i < 180 && button.isConnected && Number(document.querySelector('[aria-label="Species B count"] b')?.textContent) > 0; i++) {
      (button as HTMLButtonElement).click();
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  });
  await expect(page.locator('[aria-label="Species B count"] b')).toHaveText("0");
  expect(Number(await page.locator('[aria-label="Species A count"] b').innerText())).toBeGreaterThan(0);
  await expect(page.getByRole("button", { name: "Focus species B", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => page.evaluate(() => window.turningPointAlphas.length > 0 && window.turningPointAlphas.every(a => a >= .45))).toBe(true);
});
