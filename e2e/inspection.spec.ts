import { expect, test } from "@playwright/test";
for (const width of [1280, 390]) test(`inspect and follow real lineage at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 844 });
  await page.route("**/api/judge", route => route.abort());
  await page.goto("/");
  for (const answer of ["Rich mineral pools with abundant prey", "Toxic waves sweep across the world", "Diversify while prey and predators coexist"]) {
    await page.getByRole("textbox").fill(answer);
    await page.keyboard.press("Enter");
  }
  await page.getByRole("button", { name: /Seed ecosystem/ }).click();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const board = page.getByRole("img", { name: /ecosystem generation/i });
  await board.click({ position: { x: 19, y: 19 } });
  await expect(page.getByRole("region", { name: "Creature inspector" })).toBeVisible();
  await page.getByRole("button", { name: "Inspect a living organism" }).click();
  const inspector = page.getByRole("region", { name: "Creature inspector" });
  await expect(inspector).toContainText("Diet allowed by graph");
  await expect(inspector).toContainText("Inherited generation");
  await expect(inspector).toContainText("not a new species");
  await page.getByRole("button", { name: /Follow founder lineage/ }).click();
  await expect(inspector.getByRole("status")).toContainText("living family members");
  await page.screenshot({ path: testInfo.outputPath(`creature-details-${width}.png`), fullPage: true });
  await page.getByRole("button", { name: "Clear inspection" }).click();
  await expect(inspector).not.toContainText("Diet allowed by graph");
  await expect(inspector.getByRole("status")).toContainText("Following founder lineage");
  const generation = await page.getByTestId("generation").textContent();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(page.getByTestId("generation")).not.toHaveText(generation!);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath(`inspection-${width}.png`), fullPage: true });
  await page.getByRole("button", { name: "Stop following" }).click();
  await expect(inspector.getByRole("status")).toHaveCount(0);
});
