import { expect, test } from "@playwright/test";

for (const viewport of [{ width: 1280, height: 633 }, { width: 390, height: 850 }]) {
  test(`playback is slow by default with usable explicit controls at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    let inferenceCalls = 0;
    const runtimeErrors: string[] = [];
    page.on("pageerror", error => runtimeErrors.push(error.message));
    await page.route("**/api/judge", route => { inferenceCalls++; return route.abort(); });
    await page.goto("/play");
    await page.clock.install();
    await page.clock.pauseAt(new Date(Date.now() + 1000));
    await page.getByRole("button", { name: "Explore deterministic preset" }).click();
    await page.getByLabel("World policy").selectOption("fixed");
    await page.getByRole("button", { name: /Seed ecosystem/ }).click();
    const speed = page.getByRole("combobox", { name: "Playback speed" });
    await expect(speed).toHaveValue("slow");
    await expect(speed.locator("option")).toHaveText(["Slow", "Normal", "Fast"]);
    const box = await speed.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.y).toBeGreaterThanOrEqual(64);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    expect(await speed.evaluate(element => { const r = element.getBoundingClientRect(); return element.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); })).toBe(true);
    await page.clock.runFor(999);
    await expect(page.getByTestId("generation")).toHaveText("0 / 180");
    await page.clock.runFor(1);
    await expect(page.getByTestId("generation")).toHaveText("1 / 180");
    await speed.selectOption("normal");
    await page.clock.runFor(220);
    await expect(page.getByTestId("generation")).toHaveText("2 / 180");
    await speed.selectOption("fast");
    await page.clock.runFor(35);
    await expect(page.getByTestId("generation")).toHaveText("5 / 180");
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await speed.selectOption("slow");
    await page.clock.runFor(3000);
    await expect(page.getByTestId("generation")).toHaveText("5 / 180");
    await page.getByRole("button", { name: "Step one generation" }).click();
    await expect(page.getByTestId("generation")).toHaveText("6 / 180");
    expect(inferenceCalls).toBe(0);
    expect(runtimeErrors).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
