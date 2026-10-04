import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type TestInfo } from "@playwright/test";

function evidenceFile(testInfo: TestInfo, filename: string) {
  const directory = process.env.LIFEPOT_EVIDENCE_DIR ?? testInfo.outputDir;
  mkdirSync(directory, { recursive: true });
  return join(directory, filename);
}

async function seedPreset(page: import("@playwright/test").Page) {
  let modelCalls = 0;
  await page.route("**/api/judge**", async (route) => { modelCalls++; await route.abort(); });
  await page.goto("/");
  await page.getByRole("button", { name: "Explore deterministic preset" }).click();
  await page.getByRole("button", { name: /Seed ecosystem/ }).click();
  await expect(page.getByRole("img", { name: /ecosystem generation/i })).toBeVisible();
  await expect(page.getByTestId("generation")).not.toHaveText("0 / 180", { timeout: 5_000 });
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  return () => modelCalls;
}

async function settle(page: import("@playwright/test").Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
}

test("mobile gameplay exposes direct inspector and observatory access beside simulation controls", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 850 });
  await seedPreset(page);
  const inspect = page.getByRole("button", { name: "Inspect living organism", exact: true });
  const monitor = page.getByRole("button", { name: "World observatory", exact: true });
  await expect(inspect).toBeVisible();
  await expect(monitor).toBeVisible();
  await inspect.click();
  const inspector = page.getByRole("region", { name: "Creature inspector" });
  await expect(inspector).toContainText("Diet allowed by graph");
  await expect(inspector.getByRole("heading", { name: /Species/ })).toBeInViewport();
  await page.screenshot({ path: evidenceFile(testInfo, "mobile-inspector-390.png") });
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect.poll(async () => Number.parseInt((await page.getByTestId("generation").textContent())?.split(" ")[0] ?? "0", 10)).toBeGreaterThan(0);
  await expect(inspector).toContainText("Meet an organism");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await monitor.click();
  await expect(page.getByRole("heading", { name: "World observatory" })).toBeInViewport();
  await page.screenshot({ path: evidenceFile(testInfo, "mobile-observatory-390.png") });
});

test("running game keeps its intended dark canvas and semantic game colors under shell themes", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 850 });
  await page.emulateMedia({ colorScheme: "light" });
  let modelCalls = 0;
  await page.route("**/api/judge**", async (route) => { modelCalls++; await route.abort(); });
  await page.goto("/");
  await page.getByRole("button", { name: "Explore deterministic preset" }).click();
  await page.getByRole("button", { name: /Seed ecosystem/ }).click();
  await expect(page.getByRole("img", { name: /ecosystem generation/i })).toBeVisible();
  await settle(page);
  const theme = page.getByRole("combobox", { name: "Color theme" });
  const canvas = page.locator("canvas.life-canvas");
  const snapshot = async () => canvas.evaluate((node) => {
    const c = node as HTMLCanvasElement;
    const context = c.getContext("2d")!;
    const ratio = c.width / c.getBoundingClientRect().width;
    const size = c.getBoundingClientRect().width;
    const pad = 18, cell = (size - pad * 2) / 50;
    const organisms: number[][] = [];
    for (let y = 0; y < 50; y++) for (let x = 0; x < 50; x++) {
      const px = Math.round((pad + (x + .5) * cell) * ratio);
      const py = Math.round((pad + (y + .5) * cell) * ratio);
      organisms.push(Array.from(context.getImageData(px, py, 1, 1).data).slice(0, 3));
    }
    const backdrop = Array.from(context.getImageData(2, 2, 1, 1).data).slice(0, 3);
    const { data } = context.getImageData(0, 0, c.width, c.height);
    let varied = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i] < 80 && data[i + 1] < 120 && data[i + 2] < 100) varied++;
    return { backdrop, varied, organisms };
  });
  await page.waitForTimeout(700);
  const runningGeneration = await page.getByTestId("generation").textContent();
  const runningMetrics = await page.getByLabel("Live ecosystem statistics").innerText();
  expect(runningMetrics).toContain("LIVING VARIANTS");
  const runningColors = await canvas.evaluate(node => {
    const c = node as HTMLCanvasElement;
    const { data } = c.getContext("2d")!.getImageData(0, 0, c.width, c.height);
    const colors = new Set<string>();
    for (let i = 0; i < data.length; i += 4) if (data[i] > 70 || data[i + 1] > 90 || data[i + 2] > 70) colors.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
    return colors.size;
  });
  expect(Number.parseInt(runningGeneration?.split(" ")[0] ?? "0", 10)).toBeGreaterThan(0);
  expect(runningColors).toBeGreaterThan(3);
  await page.screenshot({ path: evidenceFile(testInfo, "running-1280-light-light.png") });
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const pausedGeneration = await page.getByTestId("generation").textContent();
  const pausedMetrics = await page.getByLabel("Live ecosystem statistics").innerText();
  expect(Number.parseInt(pausedGeneration?.split(" ")[0] ?? "0", 10)).toBeGreaterThanOrEqual(Number.parseInt(runningGeneration?.split(" ")[0] ?? "0", 10));
  for (const [mode, os] of [["light", "light"], ["dark", "dark"], ["auto", "light"], ["auto", "dark"]] as const) {
    await page.emulateMedia({ colorScheme: os });
    await theme.selectOption(mode);
    await settle(page);
    const pixels = await snapshot();
    expect(pixels.backdrop, `${mode}/${os} canvas backdrop`).toEqual([2, 10, 9]);
    expect(pixels.varied).toBeGreaterThan(100);
    expect(pixels.organisms.filter(rgb => rgb[0] > 80 || rgb[1] > 110 || rgb[2] > 90).length, `${mode}/${os} populated organism/resource colors`).toBeGreaterThan(20);
    await expect(page.getByTestId("generation")).toHaveText(pausedGeneration ?? "");
    expect(await page.getByLabel("Live ecosystem statistics").innerText()).toBe(pausedMetrics);
    await page.screenshot({ path: evidenceFile(testInfo, `paused-1280-${mode}-${os}.png`) });
  }
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect.poll(async () => Number.parseInt((await page.getByTestId("generation").textContent())?.split(" ")[0] ?? "0", 10)).toBeGreaterThan(Number.parseInt(pausedGeneration?.split(" ")[0] ?? "0", 10));
  await page.screenshot({ path: evidenceFile(testInfo, "resumed-1280-light-light.png") });
  expect(modelCalls).toBe(0);
});

test("gameplay header, stats, controls, and useful board geometry do not overlap at desktop and narrow widths", async ({ page }, testInfo) => {
  const measurements: Array<Record<string, unknown>> = [];
  for (const width of [1280, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 850 });
    const modelCalls = await seedPreset(page);
    await settle(page);
    const geometry = await page.evaluate(() => {
      const rect = (s: string) => {
        const r = document.querySelector(s)!.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom, right: r.right };
      };
      return { header: rect(".family-header"), stats: rect(".stats-strip"), controls: rect(".controls"), board: rect("canvas.life-canvas"), shell: rect(".simulation-shell"), viewport: innerWidth };
    });
    expect(geometry.stats.y, `stats below header at ${width}`).toBeGreaterThanOrEqual(geometry.header.bottom);
    expect(geometry.controls.y, `controls below stats at ${width}`).toBeGreaterThanOrEqual(geometry.stats.bottom);
    expect(geometry.board.width, `useful canvas at ${width}`).toBeGreaterThanOrEqual(width <= 390 ? width - 40 : 300);
    expect(geometry.board.height).toBeGreaterThanOrEqual(260);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const buttonCenters = await page.locator(".controls button").evaluateAll((buttons) => buttons.map(button => {
      const r = button.getBoundingClientRect();
      return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === button;
    }));
    expect(buttonCenters.length).toBe(5);
    expect(buttonCenters, `unobstructed gameplay controls at ${width}`).toEqual(Array(5).fill(true));
    measurements.push({ ...geometry, controlCentersUnobstructed: buttonCenters });
    const theme = page.getByRole("combobox", { name: "Color theme" });
    for (const [mode, os] of [["light", "light"], ["dark", "dark"], ["auto", "light"], ["auto", "dark"]] as const) {
      await page.emulateMedia({ colorScheme: os });
      await theme.selectOption(mode);
      await settle(page);
      await page.screenshot({ path: evidenceFile(testInfo, `paused-${width}-${mode}-${os}.png`) });
    }
    expect(modelCalls()).toBe(0);
  }
  writeFileSync(evidenceFile(testInfo, "geometry.json"), JSON.stringify(measurements, null, 2));
});
