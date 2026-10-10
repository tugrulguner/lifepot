import { expect, test, type Page } from "@playwright/test";
import { deterministicEvolutionDecision } from "../src/game/decisions";

async function preset(page: Page) {
  await page.route("**/api/judge", async route => {
    const payload = route.request().postDataJSON();
    if (payload.kind === "evolution") await route.fulfill({ json: deterministicEvolutionDecision(payload.summary) });
    else await route.abort();
  });
  await page.goto("/play");
  await page.getByRole("button", { name: "Explore deterministic preset" }).click();
  await page.getByRole("button", { name: /Seed ecosystem/ }).click();
}

test("temporarily collapsed board redraws safely after restoring layout", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await preset(page);
  const canvas = page.locator("canvas.life-canvas");
  await canvas.evaluate(element => { (element as HTMLElement).style.display = "none"; });
  await page.waitForTimeout(300);
  await canvas.evaluate(element => { (element as HTMLElement).style.removeProperty("display"); });
  await page.waitForTimeout(300);
  expect(errors).toEqual([]);
  expect((await canvas.boundingBox())!.width).toBeGreaterThan(100);
});

test("paused play can advance exactly one generation and species selection connects the board to its diet", async ({ page }) => {
  await preset(page);
  const step = page.getByRole("button", { name: "Step one generation" });
  await expect(step).toBeDisabled();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(step).toBeEnabled();
  const before = Number((await page.getByTestId("generation").innerText()).split(" / ")[0]);
  await step.click();
  await expect(page.getByTestId("generation")).toHaveText(`${before + 1} / 180`);
  await page.waitForTimeout(500);
  await expect(page.getByTestId("generation")).toHaveText(`${before + 1} / 180`);
  await page.getByRole("button", { name: "Focus species B", exact: true }).click();
  await expect(page.getByRole("region", { name: "Species focus" })).toContainText("Species B consumes species A");
  await expect(page.getByRole("img", { name: /ecosystem generation/i })).toHaveAttribute("data-focused-species", "B");
});

test("an optional question is not sent to the judge and fixed-rule play requests no runtime interventions", async ({ page }) => {
  test.setTimeout(210_000);
  const requests: unknown[] = [];
  await page.route("**/api/judge", async route => { requests.push(route.request().postDataJSON()); await route.abort(); });
  await page.goto("/play");
  await page.getByRole("button", { name: "Explore deterministic preset" }).click();
  await page.getByRole("textbox", { name: "Your question or prediction (optional)" }).fill("Will hunters disappear? This is a prediction, not an instruction.");
  await page.getByLabel("World policy").selectOption("fixed");
  await page.getByRole("button", { name: /Seed ecosystem/ }).click();
  await page.getByRole("button", { name: "3× speed" }).click();
  await expect(page.getByRole("heading", { name: "Observation complete", exact: true })).toBeVisible({ timeout: 180_000 });
  expect(requests).toEqual([]);
  await expect(page.getByRole("region", { name: "Run results" })).toContainText("Will hunters disappear?");
});

test("fixed-rule replay and a changed-condition trial preserve evidence without model calls", async ({ page }) => {
  test.setTimeout(600_000);
  const errors: string[] = [], calls: unknown[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/api/judge", async route => { calls.push(route.request().postDataJSON()); await route.abort(); });
  await page.goto("/play");
  await page.getByRole("button", { name: "Explore deterministic preset" }).click();
  await page.getByLabel("World policy").selectOption("fixed");
  await page.getByRole("button", { name: /Seed ecosystem/ }).click();
  await page.getByRole("button", { name: "3× speed" }).click();
  await expect(page.getByRole("region", { name: "Run results" })).toBeVisible({ timeout: 180_000 });
  const outcomes = await page.getByLabel("Observed outcomes").textContent();
  await page.getByRole("button", { name: "Replay this run", exact: true }).click();
  await expect(page.getByRole("region", { name: "Run results" })).toBeVisible({ timeout: 180_000 });
  await expect(page.getByLabel("Observed outcomes")).toHaveText(outcomes!);
  await page.getByRole("button", { name: "Edit this world", exact: true }).click();
  await page.getByText("Edit world conditions", { exact: true }).click();
  await page.getByLabel("Resource abundance").selectOption("scarce");
  await page.getByRole("button", { name: /Seed ecosystem/ }).click();
  await expect(page.getByRole("region", { name: "Run results" })).toBeVisible({ timeout: 180_000 });
  await expect(page.getByRole("region", { name: "Previous trial comparison" })).toContainText("Same initial seed");
  expect(calls).toEqual([]);
  expect(errors).toEqual([]);
});

test("ending is visible on mobile, explains the horizon, preserves inspection and produces a decodable PNG", async ({ page }, testInfo) => {
  test.setTimeout(210_000);
  await page.setViewportSize({ width: 390, height: 850 });
  await preset(page);
  await page.getByRole("button", { name: "3× speed" }).click();
  await expect(page.getByRole("heading", { name: "Observation complete", exact: true })).toBeVisible({ timeout: 180_000 });
  const results = page.getByRole("region", { name: "Run results" });
  await expect(results).toContainText("180");
  await expect(results).toContainText(/not.*biological|toy model/i);
  const heading = page.getByRole("heading", { name: "Observation complete", exact: true });
  const box = await heading.boundingBox();
  expect(box!.y).toBeGreaterThanOrEqual(64);
  expect(box!.y).toBeLessThan(850);
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Prepare result image" }).click();
  await expect(page.getByRole("img", { name: "Final world share preview" })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download image" }).click();
  const download = await downloadPromise;
  const path = testInfo.outputPath("lifepot-result.png");
  await download.saveAs(path);
  const image = await page.getByRole("img", { name: "Final world share preview" }).evaluate((img: HTMLImageElement) => ({ width: img.naturalWidth, height: img.naturalHeight, src: img.src }));
  expect(image.width).toBeGreaterThanOrEqual(1000);
  expect(image.height).toBeGreaterThanOrEqual(600);
  expect(image.src).toMatch(/^blob:/);
  await page.getByRole("button", { name: "Inspect final world" }).click();
  await expect(page.getByRole("img", { name: /ecosystem generation/i })).toBeVisible();
  await page.getByRole("button", { name: "View results", exact: true }).click();
  await page.getByRole("button", { name: "Edit this world", exact: true }).click();
  await expect(page.getByRole("heading", { name: "World conditions", exact: true })).toBeVisible();
  await expect(page.getByText(/previous run.*baseline/i)).toBeVisible();
});
