import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const example = JSON.parse(readFileSync("public/example-world.json", "utf8"));

test("direct example entry never exposes setup while the recorded replay is held", async ({ page }) => {
  await page.goto("/");
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let entered!: () => void;
  const requested = new Promise<void>(resolve => { entered = resolve; });
  await page.route("**/example-world.json", async route => {
    entered();
    await held;
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(example) });
  });
  await page.getByRole("link", { name: "Play example", exact: true }).click();
  await requested;
  await expect(page).toHaveURL(/\/play\/example$/);
  await expect(page.getByRole("heading", { name: "The little pond", exact: true })).toBeVisible();
  await expect(page.getByText("Loading the recorded world…", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Describe your own world", exact: true })).toHaveCount(0);
  await expect(page.getByText("QUESTION 1 / 3")).toHaveCount(0);
  release();
  await expect(page.getByRole("region", { name: "Run status", exact: true })).toContainText("Recorded example");
  await expect(page.locator("canvas.life-canvas")).toBeVisible();
  await expect(page.getByText("Exact recorded replay · no inference")).toBeVisible();
  await page.reload();
  await expect(page.locator("canvas.life-canvas")).toBeVisible();
  await expect(page.getByRole("region", { name: "Run status", exact: true })).toContainText("Recorded example");
});

test("direct example entry can retry a failed replay response and reaches the recorded outcome", async ({ page }) => {
  let requests = 0, allowRetry = false;
  await page.route("**/example-world.json", async route => {
    requests++;
    if (!allowRetry) return route.fulfill({ status: 503, body: "unavailable" });
    return route.fulfill({ contentType: "application/json", body: JSON.stringify(example) });
  });
  const inference: string[] = [];
  page.on("request", request => { if (/\/api\/(judge|reflect)/.test(request.url())) inference.push(request.url()); });
  await page.goto("/play/example");
  await expect(page.locator(".simulation-shell p[role=alert]")).toContainText("recorded example could not be loaded");
  allowRetry = true;
  await page.getByRole("button", { name: "Retry loading example" }).click();
  await expect(page.locator("canvas.life-canvas")).toBeVisible();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByLabel("Playback speed").selectOption("fast");
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(page.getByRole("region", { name: "Run results", exact: true })).toContainText(`generation ${example.endpoint.generation}`, { timeout: 25_000 });
  expect(requests).toBeGreaterThanOrEqual(3);
  expect(inference).toEqual([]);
  await page.getByRole("button", { name: "More camera options" }).click();
  await page.getByRole("link", { name: "Back to observatory" }).click();
  await expect(page).toHaveURL(/\/play$/);
  await expect(page.locator("#phase")).toHaveText("Paused · generation 0");
});
