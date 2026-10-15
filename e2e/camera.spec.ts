import { expect, test, type Page } from "@playwright/test";

async function completeWithRealSteps(page: Page) {
  const start = Number.parseInt((await page.getByTestId("generation").textContent())!, 10);
  const step = await page.getByRole("button", { name: "Step one generation" }).elementHandle();
  expect(step).not.toBeNull();
  // Keep every real click/render, without two protocol round trips per tick.
  const steps = await step!.evaluate(async button => {
    let count = 0;
    while (button.isConnected && count < 180) {
      (button as HTMLButtonElement).click(); count++;
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    }
    return count;
  });
  expect(steps).toBe(180 - start);
}

async function expectWatchingView(page: Page) {
  await expect.poll(() => page.evaluate(() => {
    const board = document.querySelector('canvas.life-canvas')!.getBoundingClientRect();
    const header = document.querySelector('.family-header')!.getBoundingClientRect();
    return board.top >= header.bottom && board.bottom <= innerHeight - 12;
  })).toBe(true);
}
import { mkdir } from "node:fs/promises";

for (const width of [1280, 390]) test(`camera transforms inspection and follows identities at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 850 });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  let inference = 0;
  await page.route("**/api/judge", route => { inference++; return route.abort(); });
  await page.goto("/play");
  await page.getByRole("button", { name: "Explore deterministic preset" }).click();
  await page.getByLabel("World policy", { exact: true }).selectOption("fixed");
  await page.getByRole("button", { name: /Seed ecosystem/ }).click();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const board = page.locator("canvas.life-canvas");
  const camera = page.getByRole("region", { name: "World camera", exact: true });
  const gen = await page.getByTestId("generation").textContent();
  await camera.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(board).toHaveAttribute("data-camera-zoom", "1.5");
  await expectWatchingView(page);
  await page.getByRole("button", { name: "Inspect a living organism", exact: true }).click();
  const inspector = page.getByRole("region", { name: "Creature inspector" });
  const identity = await inspector.getByText(/^Organism #\d+$/).textContent();
  await camera.getByRole("button", { name: "Follow organism with camera" }).click();
  await expect(board).toHaveAttribute("data-camera-follow", "organism");
  await expect(board).toHaveAttribute("data-camera-zoom", "2");
  // Click the rendered selected cell through the inverse camera transform.
  const position = (await inspector.innerText()).match(/\((\d+), (\d+)\)/);
  expect(position).not.toBeNull();
  await expectWatchingView(page);
  const bounds = (await board.boundingBox())!;
  const zoom = Number(await board.getAttribute("data-camera-zoom"));
  const x = Number(await board.getAttribute("data-camera-x")), y = Number(await board.getAttribute("data-camera-y"));
  const px = bounds.width / 2 + x * (bounds.width - 36) + (18 + (Number(position![1]) + .5) * (bounds.width - 36) / 50 - bounds.width / 2) * zoom;
  const py = bounds.height / 2 + y * (bounds.height - 36) + (18 + (Number(position![2]) + .5) * (bounds.height - 36) / 50 - bounds.height / 2) * zoom;
  await board.click({ position: { x: px, y: py } });
  await expect(inspector.getByText(/^Organism #\d+$/)).toHaveText(identity!);
  await expect(page.getByTestId("generation")).toHaveText(gen!);
  await inspector.getByRole("button", { name: /Follow founder lineage/ }).click();
  await camera.getByRole("button", { name: "Follow pinned family with camera" }).click();
  await expect(board).toHaveAttribute("data-camera-follow", "family");
  await expect(camera.locator('p[role="status"]')).toContainText("oldest living member");
  await expectWatchingView(page);
  const pinLabel = await inspector.getByRole("button", { name: /Follow founder lineage/ }).textContent();
  await inspector.getByRole("button", { name: "Stop following", exact: true }).click();
  await expect(board).toHaveAttribute("data-camera-follow", "none");
  await inspector.getByRole("button", { name: pinLabel!, exact: true }).click();
  await expect(board).toHaveAttribute("data-camera-follow", "none");
  await expect(board).toHaveAttribute("data-camera-zoom", "1");
  await camera.getByRole("button", { name: "Follow pinned family with camera" }).click();
  await expectWatchingView(page);
  // Deliberate scrolling after the action must not be undone by later paints.
  await page.evaluate(() => window.scrollTo(0, 120));
  const deliberateScroll = await page.evaluate(() => scrollY);
  await page.getByRole("button", { name: "Resume", exact: true }).evaluate((button: HTMLButtonElement) => button.click());
  await expect.poll(() => page.getByTestId("generation").textContent()).not.toBe(gen);
  await expect(board).toHaveAttribute("data-camera-follow", "family");
  expect(await page.evaluate(() => scrollY)).toBe(deliberateScroll);
  await board.scrollIntoViewIfNeeded();
  await mkdir(testInfo.outputDir, { recursive: true });
  await page.screenshot({ path: testInfo.outputPath(`camera-running-${width}.png`) });
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await camera.getByRole("button", { name: "Stop camera follow" }).click();
  await expect(board).toHaveAttribute("data-camera-follow", "none");
  await board.focus();
  await page.keyboard.press("Shift+ArrowRight");
  const afterKeyboard = await board.getAttribute("data-camera-x");
  await board.scrollIntoViewIfNeeded();
  const b = (await board.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 40, b.y + b.height / 2 + 20, { steps: 6 });
  await page.mouse.up();
  await expect(board).not.toHaveAttribute("data-camera-x", afterKeyboard!);
  await page.screenshot({ path: testInfo.outputPath(`camera-paused-${width}.png`) });
  await camera.getByRole("button", { name: "Full world" }).click();
  await expect(board).toHaveAttribute("data-camera-zoom", "1");
  await expect(board).toHaveAttribute("data-camera-x", "0");
  await camera.getByRole("button", { name: "Zoom in", exact: true }).click();
  await page.getByRole("button", { name: "Restart trial", exact: true }).click();
  await expect(board).toHaveAttribute("data-camera-zoom", "1");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(inference).toBe(0);
  expect(errors).toEqual([]);
});

for (const width of [1280, 390]) test(`camera releases a naturally lost target and resets for completed replay at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 850 });
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  let inference = 0; await page.route("**/api/judge", route => { inference++; return route.abort(); });
  await page.goto("/play");
  await page.getByRole("button", { name: "Explore deterministic preset" }).click();
  await page.getByLabel("World policy", { exact: true }).selectOption("fixed");
  await page.getByRole("button", { name: /Seed ecosystem/ }).click();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Inspect a living organism", exact: true }).click();
  await page.getByRole("button", { name: "Follow organism with camera" }).click();
  await page.getByLabel("Playback speed").selectOption("normal");
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  const board = page.locator("canvas.life-canvas");
  await expect(page.getByRole("status", { name: "Camera update" })).toContainText(/Organism #\d+ is no longer living/);
  await expect(page.getByRole("status", { name: "Camera update" })).toBeVisible();
  await expectWatchingView(page);
  await expect(board).toHaveAttribute("data-camera-follow", "none");
  await expect(board).toHaveAttribute("data-camera-zoom", "1");
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(board).toHaveAttribute("data-camera-zoom", "1.5");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  // Completion checks replay/camera reset, not decorative-animation throughput.
  await completeWithRealSteps(page);
  await expect(page.getByRole("region", { name: "Run results", exact: true })).toBeVisible();
  const result = page.getByRole("region", { name: "Run results", exact: true });
  const endpoint = await result.getByText(/^Observed through generation/).textContent();
  const totals = (await result.innerText()).match(/cumulative births: \d+; deaths: \d+; kills: \d+/)?.[0];
  expect(totals).toBeTruthy();
  await page.getByRole("button", { name: "Replay this run", exact: true }).click();
  await expect(page.getByRole("region", { name: "Run results", exact: true })).toHaveCount(0);
  await expect(board).toHaveAttribute("data-camera-zoom", "1");
  await expect(board).toHaveAttribute("data-camera-follow", "none");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await completeWithRealSteps(page);
  await expect(page.getByRole("region", { name: "Run results", exact: true })).toBeVisible();
  await expect(result.getByText(/^Observed through generation/)).toHaveText(endpoint!);
  expect(await result.innerText()).toContain(totals!);
  expect(inference).toBe(0); expect(errors).toEqual([]);
});

test("touch panning is opt-in and does not inspect a dragged cell", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 850 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  try {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(test.info().project.use.baseURL + "/play");
    await page.getByRole("button", { name: "Explore deterministic preset" }).click();
    await page.getByLabel("World policy", { exact: true }).selectOption("fixed");
    await page.getByRole("button", { name: /Seed ecosystem/ }).click();
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    const board = page.locator("canvas.life-canvas");
    await page.getByRole("button", { name: "Zoom in", exact: true }).click();
    await expect(board).toHaveCSS("touch-action", "pan-y");
    await page.getByRole("button", { name: "Drag to pan", exact: true }).click();
    await expect(board).toHaveCSS("touch-action", "none");
    await board.scrollIntoViewIfNeeded();
    const b = (await board.boundingBox())!;
    const session = await context.newCDPSession(page);
    const x = b.x + b.width / 2, y = b.y + b.height / 2;
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    for (let i = 1; i <= 6; i++) await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + i * 5, y: y + i * 3 }] });
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(board).not.toHaveAttribute("data-camera-x", "0");
    await expect(page.getByText(/^Organism #\d+$/)).toHaveCount(0);
    await page.getByRole("button", { name: "Drag to pan", exact: true }).click();
    await expect(board).toHaveCSS("touch-action", "pan-y");
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});
