import { expect, test, type Locator, type Page } from "@playwright/test";

async function unobscured(page: Page, target: Locator, top: number) {
  await target.evaluate((node, top) => window.scrollTo(0, scrollY + node.getBoundingClientRect().top - top), top);
  return target.evaluate(node => {
    const r = node.getBoundingClientRect();
    const points = [0.1, 0.5, 0.9].flatMap(x => [0.2, 0.5, 0.8].map(y => ({ x: r.left + r.width * x, y: r.top + r.height * y })));
    return { scrollY, rect: r.toJSON(), hits: points.map(({ x, y }) => {
      const hit = document.elementFromPoint(x, y);
      return { x, y, clear: hit === node || node.contains(hit), hit: hit?.tagName, className: hit?.getAttribute("class") };
    }) };
  });
}

test("real 180-generation results graph and actions stay unobscured at scrolled sticky positions", async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Explore deterministic preset" }).click();
  await page.getByRole("button", { name: /Seed ecosystem/ }).click();
  await page.getByRole("button", { name: "3× speed" }).click();
  await expect(page.getByTestId("generation")).toHaveText("180 / 180", { timeout: 180_000 });
  const results = page.getByRole("region", { name: "Run results" });
  await expect(results).toBeVisible();
  for (const viewport of [{ width: 1280, height: 850 }, { width: 1280, height: 633 }, { width: 768, height: 850 }, { width: 390, height: 850 }, { width: 320, height: 850 }]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => document.fonts.ready);
    const evidence = [];
    for (const top of [100, 220]) {
      const graph = await unobscured(page, results.getByRole("img", { name: "Whole-run population history" }), top);
      evidence.push({ top, graph });
      expect.soft(graph.hits.every(hit => hit.clear), JSON.stringify({ viewport, top, graph })).toBe(true);
    }
    for (const button of await results.getByRole("navigation", { name: "Run actions" }).getByRole("button").all()) {
      const action = await unobscured(page, button, 140);
      evidence.push({ action });
      expect.soft(action.hits.every(hit => hit.clear), JSON.stringify({ viewport, action })).toBe(true);
      await button.click({ trial: true });
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await testInfo.attach(`sticky-${viewport.width}x${viewport.height}.json`, { body: JSON.stringify(evidence, null, 2), contentType: "application/json" });
    await results.getByRole("img", { name: "Whole-run population history" }).evaluate(node => window.scrollTo(0, scrollY + node.getBoundingClientRect().top - 100));
    await testInfo.attach(`sticky-${viewport.width}x${viewport.height}.png`, { body: await page.screenshot(), contentType: "image/png" });
  }
  await results.getByRole("button", { name: "Inspect final world", exact: true }).click();
  await expect(results).toHaveCount(0);
  await expect(page.getByTestId("generation")).toHaveText("180 / 180");
  expect(errors).toEqual([]);
});
