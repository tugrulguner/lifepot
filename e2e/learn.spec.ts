import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

test("learn index and canonical guide pages render and serve matching Markdown", async ({ page, request }) => {
  const home = await page.goto("/learn");
  expect(home?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Learn LifePot" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Player guide" }).first()).toHaveAttribute("href", "/learn/player-guide");
  await expect(page.getByRole("link", { name: "Developer reference" }).first()).toHaveAttribute("href", "/learn/developer-reference");

  for (const [slug, heading, marker] of [
    ["player-guide", "Player guide: shape a world, read its history", "Explore deterministic preset"],
    ["developer-reference", "Developer reference: contracts, deterministic execution, and operations", "JUDGE_RATE_LIMIT"],
  ]) {
    const response = await request.get(`/learn/${slug}/markdown`);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/markdown");
    const markdown = await response.text();
    const canonical = await readFile(resolve(process.cwd(), "docs/learn", `${slug}.md`), "utf8");
    expect(markdown).toBe(canonical);
    await page.goto(`/learn/${slug}`);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await expect(page.getByText(marker, { exact: false }).first()).toBeVisible();
    if (slug === "player-guide") {
      await expect(page.locator(".learn-prose strong")).toHaveCount(13);
      await expect(page.locator(".learn-prose strong").first()).toHaveText("What exists in this world?");
    } else {
      await expect(page.locator(".learn-prose table")).toBeVisible();
      await expect(page.locator(".learn-prose pre code").first()).toBeVisible();
    }
    await expect(page.getByRole("link", { name: "Download source Markdown" })).toHaveAttribute("href", `/learn/${slug}/markdown`);
    expect(markdown).toContain(marker);
    expect(markdown).toContain(heading);
  }
});

test("learn pages stay readable at narrow viewport and keep the game link", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/learn/developer-reference");
  await expect(page.getByRole("link", { name: "← Return to the living world" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});
