import { expect, test } from "@playwright/test";
import { guideMarkdown, guides } from "../src/app/learn/content";

test("all task-first documentation pages and downloads use the same canonical content", async ({ page, request }) => {
  for (const guide of guides) {
    const response = await page.goto(`/learn/${guide.slug}`);
    expect(response?.status(), guide.slug).toBe(200);
    await expect(page.locator(".learn-prose h1")).toHaveCount(1);
    await expect(page.getByRole("navigation", { name: "Documentation navigation" })).toBeVisible();
    await expect(page.locator(`[aria-current="page"][href="/learn/${guide.slug}"]`)).toBeVisible();
    const download = await request.get(`/learn/${guide.slug}/markdown`);
    expect(download.ok()).toBe(true);
    expect(await download.text()).toBe(guideMarkdown(guide.slug));
    for (const link of await page.locator('.learn-prose a[href^="/learn/"]').evaluateAll(links => links.map(link => link.getAttribute("href")!))) {
      expect((await request.get(link)).ok(), link).toBe(true);
    }
  }
});

test("overview has first-fold Play and preserves the keyless game entry across themes and viewports", async ({ page }, info) => {
  test.setTimeout(90_000);
  await page.route("**/api/judge**", route => route.abort());
  for (const width of [1280, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 850 });
    for (const theme of ["light", "dark", "auto"]) {
      await page.emulateMedia({ colorScheme: theme === "light" ? "dark" : "light" });
      await page.goto("/");
      await expect(page.getByRole("link", { name: "Skip to main content" })).toBeAttached();
      await page.keyboard.press("Tab");
      const skip = page.getByRole("link", { name: "Skip to main content" });
      await expect(skip).toBeFocused();
      await expect(skip).toBeInViewport();
      await skip.press("Enter");
      await expect(page.locator("#overview-content")).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(page.getByRole("link", { name: "Create your own world" })).toBeFocused();
      await page.goto("/");
      await page.getByRole("combobox", { name: "Color theme" }).selectOption(theme);
      await expect(page.getByRole("combobox", { name: "Color theme" })).toHaveValue(theme);
      const play = page.locator(".overview-actions").getByRole("link", { name: "Create your own world" });
      await expect(play).toHaveAttribute("href", "/play");
      const box = await play.boundingBox();
      expect(box && box.y >= 0 && box.y + box.height < 850).toBe(true);
      const architecture = page.locator('.overview-mechanism img');
      await expect.poll(() => architecture.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: info.outputPath(`overview-${width}-${theme}.png`), fullPage: true });
      await play.click();
      await expect(page).toHaveURL(/\/play$/);
      await expect(page.getByRole("button", { name: "Explore deterministic preset" })).toBeVisible();
    }
    await page.goto("/learn/contracts");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`contracts-${width}.png`), fullPage: true });
  }
});

test("Play skip link bypasses FamilyHeader and tabs into the question content", async ({ page }) => {
  await page.route("**/api/judge**", route => route.abort());
  await page.goto("/play");
  const skip = page.getByRole("link", { name: "Skip to main content" });
  // Preserve the application's deliberate question autofocus. Reach the preceding
  // skip link using real keyboard traversal rather than imperatively focusing it.
  await expect(page.getByRole("textbox").first()).toBeFocused();
  for (let index = 0; index < 20 && !(await skip.evaluate(element => element === document.activeElement)); index++) {
    await page.keyboard.press("Shift+Tab");
  }
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await skip.press("Enter");
  await expect(page.locator("#play-content")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect.poll(() => page.locator("#play-content").evaluate(element => element.contains(document.activeElement) && element !== document.activeElement)).toBe(true);
});

test("skip navigation enters Learn, review, and paused-world content without inference", async ({ page }) => {
  test.setTimeout(60_000);
  let judgeCalls = 0;
  await page.route("**/api/judge**", route => { judgeCalls++; return route.abort(); });
  const reachSkip = async () => {
    const skip = page.getByRole("link", { name: "Skip to main content" });
    await expect(skip).toHaveCount(1);
    if (await page.evaluate(() => document.activeElement === document.body || document.activeElement === document.documentElement)) await page.keyboard.press("Tab");
    for (let index = 0; index < 30 && !(await skip.evaluate(element => element === document.activeElement)); index++) await page.keyboard.press("Shift+Tab");
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await skip.press("Enter");
  };
  for (const width of [1280, 320]) {
    await page.setViewportSize({ width, height: 850 });
    for (const route of ["/learn", "/learn/contracts"]) {
      await page.goto(route);
      await reachSkip();
      await expect(page.locator("#learn-content")).toBeFocused();
      await page.keyboard.press("Tab");
      await expect.poll(() => page.locator("#learn-content").evaluate(element => element.contains(document.activeElement) && element !== document.activeElement)).toBe(true);
    }
    for (const [route, targetId] of [["/project-docs/readme", "source-document-content"], ["/missing-keyboard-test-route", "not-found-content"]]) {
      const response = await page.goto(route);
      expect(response?.status()).toBe(route.startsWith("/missing") ? 404 : 200);
      await reachSkip();
      const target = page.locator(`#${targetId}`);
      await expect(target).toBeFocused();
      await page.keyboard.press("Tab");
      await expect.poll(() => target.evaluate(element => element.contains(document.activeElement) && element !== document.activeElement)).toBe(true);
    }
    await page.goto("/play");
    await page.getByRole("button", { name: "Explore deterministic preset" }).click();
    await expect(page.getByRole("heading", { name: "World conditions", exact: true })).toBeVisible();
    await reachSkip();
    await expect(page.locator("#play-content")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect.poll(() => page.locator("#play-content").evaluate(element => element.contains(document.activeElement) && element !== document.activeElement)).toBe(true);
    await page.getByLabel("World policy").selectOption("fixed");
    await page.getByRole("button", { name: /Seed ecosystem/ }).click();
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await reachSkip();
    await expect(page.locator("#play-content")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.locator("canvas")).toBeFocused();
  }
  expect(judgeCalls).toBe(0);
});
