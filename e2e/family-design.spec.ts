import { expect, test } from "@playwright/test";

async function settle(page: import("@playwright/test").Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
}

test("family foundation renders shared typography, neutral surfaces, and accessible theme control", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await settle(page);
  const header = page.locator(".brand-bar");
  await expect(header).toBeVisible();
  expect(await header.evaluate((el) => getComputedStyle(el).height)).toBe("64px");
  expect(await page.locator("body").evaluate((el) => getComputedStyle(el).fontFamily)).toContain("Avenir Next");
  const theme = page.getByRole("combobox", { name: "Color theme" });
  await expect(theme).toHaveValue("auto");
  for (const [value, canvas] of [["light", "rgb(248, 247, 244)"], ["dark", "rgb(22, 24, 27)"]] as const) {
    await theme.selectOption(value);
    await expect(page.locator("html")).toHaveAttribute("data-theme", value);
    expect(await page.locator("body").evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(canvas);
    const ratio = await page.locator(".primary-button").evaluate((button) => {
      const rgb = (value: string) => value.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(component => {
        const channel = component / 255;
        return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
      });
      const [foreground, background] = [getComputedStyle(button).color, getComputedStyle(button).backgroundColor].map(rgb);
      const luminance = (channels: number[]) => .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
      const a = luminance(foreground), b = luminance(background);
      return { ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05), foreground: getComputedStyle(button).color, background: getComputedStyle(button).backgroundColor, disabled: button.hasAttribute('disabled') };
    });
    expect(ratio.ratio, `${value}: ${JSON.stringify(ratio)}`).toBeGreaterThanOrEqual(4.5);
  }
  await theme.selectOption("auto");
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Color theme" })).toHaveValue("auto");
});

test("deterministic setup, simulation controls, pause, and replay remain intact across themes", async ({ page }) => {
  let judgeCalls = 0;
  await page.route("**/api/judge", (route) => { judgeCalls++; return route.abort(); });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await page.getByRole("combobox", { name: "Color theme" }).selectOption("light");
  await page.getByRole("button", { name: "Explore deterministic preset" }).click();
  await expect(page.getByRole("heading", { name: "World conditions" })).toBeVisible();
  await page.getByRole("button", { name: /Seed ecosystem/ }).click();
  await expect(page.getByRole("img", { name: /ecosystem generation/i })).toBeVisible();
  await expect(page.getByTestId("generation")).not.toHaveText("0 / 180", { timeout: 5_000 });
  await page.getByRole("button", { name: "Pause" }).click();
  await page.waitForTimeout(300);
  const pausedGeneration = await page.getByTestId("generation").textContent();
  await page.waitForTimeout(500);
  await expect(page.getByTestId("generation")).toHaveText(pausedGeneration ?? "");
  await page.getByRole("button", { name: /Restart/ }).click();
  await expect(page.getByTestId("generation")).toHaveText("0 / 180");
  await expect(page.getByRole("link", { name: /ModePot/ })).toHaveAttribute("href", "https://modepot.io/");
  expect(judgeCalls).toBe(0);
});

test("theme controls and layout fit narrow screens and follow live OS Auto changes", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  for (const width of [1280, 768, 320]) {
    await page.setViewportSize({ width, height: width === 320 ? 390 : 768 });
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    await page.goto("/");
    await settle(page);
    const theme = page.getByRole("combobox", { name: "Color theme" });
    await expect(theme).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    expect(await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= innerWidth)).toBe(true);
    await theme.selectOption("auto");
    await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(await page.locator("body").evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(22, 24, 27)");
  }
});

 test("paused ecosystem canvas repaints for explicit and live Auto theme changes without advancing", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await page.getByRole("button", { name: "Explore deterministic preset" }).click();
  await page.getByRole("button", { name: /Seed ecosystem/ }).click();
  const canvas = page.locator("canvas.life-canvas");
  await expect(canvas).toBeVisible();
  await page.getByRole("button", { name: "Pause" }).click();
  const before = await page.getByTestId("generation").textContent();
  const population = await page.getByLabel("Live ecosystem statistics").textContent();
  const pixel = () => canvas.evaluate((node) => {
    const el = node as HTMLCanvasElement;
    const data = el.getContext("2d")!.getImageData(2, 2, 1, 1).data;
    return Array.from(data).slice(0, 3).join(",");
  });
  expect(await pixel()).toBe("248,247,244");
  const theme = page.getByRole("combobox", { name: "Color theme" });
  await theme.selectOption("dark");
  await expect.poll(pixel).toBe("22,24,27");
  await expect(page.getByTestId("generation")).toHaveText(before ?? "");
  await expect(page.getByLabel("Live ecosystem statistics")).toHaveText(population ?? "");
  await theme.selectOption("auto");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect.poll(pixel).toBe("22,24,27");
  await expect(page.getByTestId("generation")).toHaveText(before ?? "");
  await expect(page.getByLabel("Live ecosystem statistics")).toHaveText(population ?? "");
});
