import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

test("public positioning distinguishes adaptive decisions from recorded replay", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.locator(".overview-mechanism")).toContainText("In adaptive worlds, Jev");
  await expect(page.locator(".overview-mechanism")).toContainText("mutation policies");
  await expect(page.locator(".overview-mechanism")).toContainText("not direct control of individual organisms");
  await expect(page.locator(".overview-mechanism")).toContainText("Fixed-rule starters");
  await expect(page.locator(".overview-mechanism")).toContainText("recorded decisions");
  expect(await page.content()).not.toMatch(/deterministic artificial[- ]life/i);
  for (const selector of ['meta[name="description"]', 'meta[property="og:description"]', 'meta[name="twitter:description"]']) {
    await expect(page.locator(selector)).toHaveAttribute("content", /evolutionary policies in adaptive worlds/);
  }
  const structured = JSON.parse(await page.locator('script[type="application/ld+json"]').innerText());
  expect(structured.description).toContain("without directly controlling organisms");
  const llms = await request.get("/llms.txt");
  expect(llms.status()).toBe(200);
  expect(await llms.text()).toBe(await readFile("public/llms.txt", "utf8"));
  for (const [slug, source] of [
    ["player-guide", "docs/learn/player-guide.md"],
    ["developer-reference", "docs/learn/developer-reference.md"],
    ["quick-start", "docs/learn/quick-start.md"],
    ["architecture", "docs/architecture.md"],
    ["simulation-contract", "docs/simulation-contract.md"],
  ]) {
    const response = await request.get(`/learn/${slug}/markdown`);
    expect(response.status()).toBe(200);
    expect(await response.text()).toBe(await readFile(source, "utf8"));
  }
  await page.goto("/learn/player-guide");
  await expect(page.locator(".learn-prose")).toContainText("Jev does not directly control individual organisms");
  await page.goto("/project-docs/readme");
  await expect(page.getByText("Shape a world and watch life unfold.", { exact: false }).first()).toBeVisible();
});
