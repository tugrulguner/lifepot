import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";

// Opt-in real inference against an approved preview, never production by default.
const origin = process.env.LIFEPOT_LIVE_GAMEPLAY_BASE_URL;
test.describe("live Jev setup and gameplay", () => {
 test.skip(!origin, "Requires an explicitly approved live preview origin");
 test.use({ baseURL: origin, actionTimeout: 15000 });
 test.describe.configure({ timeout: 600000 });
 const cases = [
  ["A pond with algae, algae-eating grazers, and hunters that eat grazers.", "Moderate drought", "Observe coexistence"],
  ["Rich mineral pools with abundant prey", "Predator packs hunt through pulsing droughts", "Diversify while prey and predators coexist"],
 ];
 for (const [index, answers] of cases.entries()) test(`ordinary live setup ${index + 1}${index === 0 ? " through reflection, mobile follow-up and replay" : " accepts supplied examples"}`, async ({ page }, info) => {
  const errors: string[] = []; const network: unknown[] = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("response", async r => {
   if (!/\/api\/(judge|reflect)$/.test(new URL(r.url()).pathname)) return;
   try {
    const event: Record<string, unknown> = { url: r.url(), status: r.status(), request: r.request().postDataJSON() };
    network.push(event);
    if (r.ok()) event.response = await r.json();
    await writeFile(info.outputPath("live-network.json"), JSON.stringify(network, null, 2));
   } catch { /* Assertions on awaited responses handle failures. */ }
  });
  await page.setViewportSize({ width: 1280, height: 850 });
  await page.goto("/");
  let response;
  for (const [i, answer] of answers.entries()) {
   await page.locator("input").fill(answer);
   if (i === 2) { const pending = page.waitForResponse(r => r.url().endsWith("/api/judge"), { timeout: 90000 }); await page.getByRole("button", { name: /Continue|Review ecosystem/ }).click(); response = await pending; }
   else await page.getByRole("button", { name: /Continue|Review ecosystem/ }).click();
  }
  const setup = await response!.json();
  await writeFile(info.outputPath("live-setup.json"), JSON.stringify(setup, null, 2));
  expect(setup.source).toBe("jev"); expect(setup.fidelity.verdict).toBe("approve");
  await expect(page.getByRole("button", { name: /Seed ecosystem/ })).toBeEnabled();
  if (index !== 0) return;
  const question = "PRIVATE live review prediction";
  await page.getByLabel("Your question or prediction (optional)").fill(question);
  await page.getByRole("button", { name: /Seed ecosystem/ }).click();
  const canvas = page.locator("canvas").first();
  await expect(canvas).toBeVisible();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Inspect a living organism", exact: true }).click();
  await page.getByRole("button", { name: /Follow founder lineage/ }).click();
  await page.getByRole("button", { name: "Step one generation", exact: true }).click();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await page.getByRole("button", { name: "3× speed", exact: true }).click();
  const results = page.getByRole("region", { name: "Run results", exact: true });
  await expect(results).toBeVisible({ timeout: 240000 });
  await writeFile(info.outputPath("live-trial.txt"), await page.locator("body").innerText());
  const reflectionPending = page.waitForResponse(r => r.url().endsWith("/api/reflect"), { timeout: 60000 });
  await page.getByRole("button", { name: "Ask Jev about this run" }).click();
  const reflectionResponse = await reflectionPending;
  expect(reflectionResponse.status()).toBe(200);
  expect(reflectionResponse.request().postData()).not.toContain(question);
  const reflection = await reflectionResponse.json(); expect(reflection.metadata.source).toBe("typesafe");
  await expect(page.getByRole("button", { name: "Review suggested experiment" })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 850 });
  await page.getByRole("button", { name: "Review suggested experiment" }).click();
  await expect(page.getByText(/previous run is kept as the baseline/)).toBeVisible();
  await page.getByRole("button", { name: /Seed ecosystem/ }).click();
  await expect(results).toBeVisible({ timeout: 240000 });
  await expect(page.getByRole("region", { name: "Previous trial comparison" })).toBeVisible();
  const outcomes = await page.getByRole("list", { name: "Observed outcomes" }).innerText();
  await writeFile(info.outputPath("mobile-followup.txt"), await page.locator("body").innerText());
  const replay = page.getByRole("button", { name: "Replay this run" });
  await replay.scrollIntoViewIfNeeded();
  let judgeRequests = 0;
  page.on("request", r => { if (r.url().endsWith("/api/judge")) judgeRequests++; });
  await replay.click();
  await expect.poll(() => canvas.evaluate(c => c.getBoundingClientRect().top)).toBeGreaterThanOrEqual(0);
  await expect.poll(() => canvas.evaluate(c => c.getBoundingClientRect().bottom)).toBeLessThanOrEqual(850);
  await expect(results).toBeVisible({ timeout: 180000 });
  expect(await page.getByRole("list", { name: "Observed outcomes" }).innerText()).toBe(outcomes);
  expect(judgeRequests).toBe(0); expect(errors).toEqual([]);
  const runtime = network.filter(event => (event as { request?: { kind?: string } }).request?.kind === "evolution");
  expect(runtime.length).toBeGreaterThan(0);
  for (const event of runtime) expect((event as { response?: { source?: string } }).response?.source).toBe("jev");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await writeFile(info.outputPath("live-network.json"), JSON.stringify(network, null, 2));
  await page.screenshot({ path: info.outputPath("mobile-results.png"), fullPage: true });
 });
});
