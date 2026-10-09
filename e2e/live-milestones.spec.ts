import { expect, test } from "@playwright/test";

test("real species and followed-family extinction remain near the board after inspection is cleared and the family is unpinned", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  const calls: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/api/judge", async route => { calls.push(route.request().url()); await route.abort(); });
  await page.goto("/");
  await page.getByRole("button", { name: "Explore deterministic preset" }).click();
  await page.getByText("Edit world conditions", { exact: true }).click();
  await page.getByLabel("Resource abundance").selectOption("scarce");
  await page.getByLabel("World policy").selectOption("fixed");
  await page.getByRole("button", { name: /Seed ecosystem/ }).click();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Inspect living organism", exact: true }).click();
  const follow = page.getByRole("button", { name: /^Follow founder lineage #/ });
  const lineage = (await follow.innerText()).match(/#(\d+)/)![1];
  await follow.click();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await page.getByRole("button", { name: "3× speed" }).click();
  const milestones = page.getByRole("region", { name: "Observed extinction milestones" });
  await expect(milestones).toContainText("Species B first observed extinct at generation", { timeout: 120_000 });
  // Under ca8 the hunters disappear while grazers survive; verify the event during play.
  await expect(page.getByRole("region", { name: "Run status" })).toContainText("Running");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const nearBoard = page.getByRole("region", { name: "Near-board observations" });
  await expect(nearBoard).toContainText(`Following lineage #${lineage}`);
  await expect(page.getByRole("status", { name: "Latest retained extinction" })).toContainText("Species B first observed extinct");
  // The short notice is presented in the watching region, not only in the detailed inspector.
  await expect(page.getByRole("status", { name: "Latest retained extinction" })).toBeInViewport();
  await expect(milestones).toContainText(`Founder lineage #${lineage} first observed extinct at generation`);
  await page.getByRole("button", { name: "Stop following", exact: true }).click();
  await expect(nearBoard).toContainText("No founder lineage followed");
  await expect(page.getByRole("status", { name: "Latest retained extinction" })).toContainText(`Founder lineage #${lineage} first observed extinct`);
  await expect(milestones).toContainText(`Founder lineage #${lineage} first observed extinct at generation`);
  for (const viewport of [{ width: 1280, height: 850 }, { width: 390, height: 850 }]) {
    await page.setViewportSize(viewport);
    // Test the ordinary watching position after the retained notice grows.
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect.poll(async () => {
      const board = await page.getByRole("img", { name: /ecosystem generation/i }).boundingBox();
      return board!.y + board!.height;
    }).toBeLessThanOrEqual(viewport.height - 12);
    await milestones.scrollIntoViewIfNeeded();
    const placement = await page.evaluate(() => {
      const canvas = document.querySelector("canvas.life-canvas")!.getBoundingClientRect();
      const inspector = document.querySelector("#creature-inspector")!.getBoundingClientRect();
      const milestone = document.querySelector(".extinction-milestones")!.getBoundingClientRect();
      const hit = document.elementFromPoint(milestone.left + milestone.width / 2, milestone.top + 15);
      return { gap: inspector.top - canvas.bottom, readable: !!hit && document.querySelector(".extinction-milestones")!.contains(hit), overflow: document.documentElement.scrollWidth > innerWidth };
    });
    expect(placement.gap).toBeGreaterThanOrEqual(0);
    expect(placement.gap).toBeLessThan(100);
    expect(placement.readable).toBe(true);
    expect(placement.overflow).toBe(false);
    await testInfo.attach(`live-milestones-${viewport.width}.png`, { body: await page.screenshot(), contentType: "image/png" });
  }
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(page.getByRole("region", { name: "Run results" })).toBeVisible({ timeout: 120_000 });
  await page.getByRole("button", { name: "Inspect final world", exact: true }).click();
  await expect(milestones).toContainText(`Founder lineage #${lineage} first observed extinct at generation`);
  await expect(milestones).toContainText("Species B first observed extinct at generation");
  expect(calls).toEqual([]);
  expect(errors).toEqual([]);
});
