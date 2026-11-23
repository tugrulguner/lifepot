import { expect, test } from "@playwright/test";
for (const width of [390, 1280]) test(`approved microscopic magnifications at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/experiment");
  await page.getByRole("button", {name:"Explore deterministic preset"}).click();
  await page.getByLabel("World policy", {exact:true}).selectOption("fixed");
  await page.getByRole("button", {name:/Seed ecosystem/}).click();
  await page.getByRole("button", {name:"Pause",exact:true}).click();
  if (width <= 600) await page.getByRole("button", { name: "View options", exact: true }).click();
  const generation = await page.getByTestId("generation").innerText();
  for (const zoom of [2,5,10]) {
    await page.getByRole("button", {name:`${zoom}× magnification`,exact:true}).click();
    await expect(page.locator("canvas.life-canvas")).toHaveAttribute("data-camera-zoom", String(zoom));
    await expect(page.getByTestId("generation")).toHaveText(generation);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await expect(page.getByRole("button", {name:"Zoom in",exact:true})).toBeDisabled();
  await page.getByRole("button", {name:"Full world",exact:true}).click();
  await expect(page.locator("canvas.life-canvas")).toHaveAttribute("data-camera-zoom", "1");
});
