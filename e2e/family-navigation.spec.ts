import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const evidence = process.env.LIFEPOT_EVIDENCE_DIR ?? resolve(process.cwd(), "test-results/navigation-completion");
mkdirSync(evidence, { recursive: true });

const resources = [
  ["ModePot", "https://modepot.io/"],
  ["GitHub", "https://github.com/tugrulguner/lifepot"],
  ["Community", "https://discord.gg/u3AANZr6RG"],
  ["About Tugrul", "https://tugrul.modepot.io/"],
] as const;

async function settle(page: import("@playwright/test").Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
}

test("family resources are visible desktop links with the contracted order and target geometry", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/play");
  await settle(page);
  const header = page.locator(".family-header");
  await expect(header).toBeVisible();
  expect(await header.evaluate((element) => Math.round(element.getBoundingClientRect().height))).toBe(64);
  await page.screenshot({ path: `${evidence}/setup-desktop.png`, fullPage: true });
  const links = header.getByRole("navigation", { name: "ModePot family" }).getByRole("link");
  await expect(links).toHaveCount(4);
  for (const [index, [name, href]] of resources.entries()) {
    const link = links.nth(index);
    await expect(link).toHaveText(name);
    await expect(link).toHaveAttribute("href", href);
    const box = await link.boundingBox();
    expect(box, name).not.toBeNull();
    expect(box!.width, name).toBeGreaterThanOrEqual(44);
    expect(box!.height, name).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest("a")?.textContent?.trim(), { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 })).toBe(name);
  }
  await page.locator(".setup-intro summary").click();
  const creator = page.getByRole("link", { name: "Created by Tugrul Guner" });
  await expect(creator).toHaveAttribute("href", "https://tugrul.modepot.io/");
  const creatorBox = await creator.boundingBox();
  expect(creatorBox).not.toBeNull();
  expect(creatorBox!.y + creatorBox!.height).toBeLessThanOrEqual(900);
});

test("compact menu keeps ModePot visible and exposes ordered resources before docs with Escape focus return", async ({ page }) => {
  for (const width of [768, 401, 400, 390, 320]) {
    await page.setViewportSize({ width, height: 850 });
    await page.goto("/play");
    await settle(page);
    const header = page.locator(".family-header");
    await expect(header.getByRole("link", { name: "ModePot" })).toBeVisible();
    await expect(header.getByRole("button", { name: "Menu" })).toBeVisible();
    expect(await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= innerWidth)).toBe(true);
    const menuButton = header.getByRole("button", { name: "Menu" });
    await menuButton.focus();
    await page.keyboard.press("Enter");
    await expect(menuButton).toHaveAttribute("aria-expanded", "true");
    const menu = page.getByRole("region", { name: "Menu" });
    await expect(menu).toBeVisible();
    if (width === 390) await page.screenshot({ path: `${evidence}/menu-390-open.png`, fullPage: true });
    const menuLinks = menu.getByRole("navigation", { name: "ModePot family" }).getByRole("link");
    await expect(menuLinks).toHaveCount(3);
    for (const [index, [name, href]] of resources.slice(1).entries()) {
      const link = menuLinks.nth(index);
      await expect(link).toHaveText(name);
      await expect(link).toHaveAttribute("href", href);
      const box = await link.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.y).toBeGreaterThanOrEqual(64);
      expect(box!.y + box!.height).toBeLessThanOrEqual(850);
      expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest("a")?.textContent?.trim(), { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 })).toBe(name);
    }
    const productLinks = menu.getByRole("navigation", { name: "LifePot navigation" }).getByRole("link");
    await expect(productLinks).toHaveText(["Overview", "Learn", "Play"]);
    for (const [index, href] of ["/", "/learn", "/play"].entries()) {
      await expect(productLinks.nth(index)).toHaveAttribute("href", href);
    }
    await page.keyboard.press("Escape");
    await expect(menuButton).toHaveAttribute("aria-expanded", "false");
    await expect(menuButton).toBeFocused();
  }
});

test("family navigation and About Tugrul are present on LifePot learn routes and 404 shell", async ({ page }) => {
  for (const path of ["/learn", "/learn/player-guide", "/learn/developer-reference", "/missing-family-route"]) {
    await page.setViewportSize({ width: 1280, height: 900 });
    const response = await page.goto(path);
    if (path === "/missing-family-route") expect(response?.status()).toBe(404);
    const header = page.locator(".family-header");
    await expect(header.getByRole("navigation", { name: "ModePot family" }).getByRole("link", { name: "About Tugrul" })).toHaveAttribute("href", "https://tugrul.modepot.io/");
  }
});

test("creator attribution is in the setup intro and deterministic preset remains offline", async ({ page }) => {
  let judgeCalls = 0;
  await page.route("**/api/judge", (route) => { judgeCalls++; return route.abort(); });
  await page.setViewportSize({ width: 320, height: 850 });
  await page.goto("/play");
  const intro = page.locator(".setup-intro");
  await intro.locator("summary").click();
  await expect(intro.getByRole("link", { name: "Created by Tugrul Guner" })).toHaveAttribute("href", "https://tugrul.modepot.io/");
  await intro.getByRole("link", { name: "Created by Tugrul Guner" }).scrollIntoViewIfNeeded();
  await expect(intro.getByRole("link", { name: "Created by Tugrul Guner" })).toBeInViewport();
  await page.getByRole("button", { name: "Explore deterministic preset" }).click();
  await expect(page.getByRole("heading", { name: "World conditions" })).toBeVisible();
  const reviewMenuButton = page.getByRole("button", { name: "Menu" });
  await reviewMenuButton.click();
  await expect(page.getByRole("region", { name: "Menu" }).getByRole("link", { name: "About Tugrul" })).toHaveAttribute("href", "https://tugrul.modepot.io/");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /Seed ecosystem/ }).click();
  await expect(page.getByRole("img", { name: /ecosystem generation/i })).toBeVisible();
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByRole("button", { name: "Resume" })).toBeVisible();
  await page.screenshot({ path: `${evidence}/simulation-paused.png`, fullPage: true });
  await page.getByRole("button", { name: "Menu" }).click();
  await expect(page.getByRole("region", { name: "Menu" }).getByRole("navigation", { name: "ModePot family" }).getByRole("link", { name: "About Tugrul" })).toHaveAttribute("href", "https://tugrul.modepot.io/");
  expect(judgeCalls).toBe(0);
});
