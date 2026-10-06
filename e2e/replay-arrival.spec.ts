import { test, expect } from "@playwright/test";
import { defaultConfig, hashSetupRequest } from "../src/game/setup";
import { createReplay, encodeReplay } from "../src/game/replay";
import { createSimulation } from "../src/game/world";
import { runFreshWithDecisions } from "../src/game/runtime";
import { deterministicEvolutionDecision } from "../src/game/decisions";
import type { SetupAnswers } from "../src/game/setup";

test("replay arrival positions the board once and later ticks preserve deliberate scrolling", async ({ page }) => {
  test.setTimeout(240000);
  await page.setViewportSize({ width: 390, height: 844 });
  const answers: SetupAnswers = { world: "A small habitat", threat: "Seasonal drought", reward: "Observe diversity" };
  const config = defaultConfig();
  const { ledger } = await runFreshWithDecisions(createSimulation({ seed: 17, config }), answers, async (summary) => deterministicEvolutionDecision(summary));
  const replay = createReplay({ answers, config, seed: 17, requestHash: hashSetupRequest(answers), ledger });
  const token = encodeReplay(replay);
  await page.goto(`/#replay=${encodeURIComponent(token)}`);
  const canvas = page.locator("canvas").first();
  await expect(canvas).toBeVisible();
  await expect(page.getByText(/Exact recorded replay/)).toBeVisible();
  await expect.poll(() => canvas.evaluate((element) => element.getBoundingClientRect().top)).toBeGreaterThanOrEqual(0);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const deliberateScroll = await page.evaluate(() => window.scrollY);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(deliberateScroll);
  await expect(page.getByRole("region", { name: "Run results" })).toBeVisible({ timeout: 180000 });
  const replayButton = page.getByRole("button", { name: "Replay this run" });
  await replayButton.scrollIntoViewIfNeeded();
  expect(await canvas.evaluate(e => e.getBoundingClientRect().top)).toBeLessThan(0);
  await replayButton.click();
  await expect.poll(() => canvas.evaluate(e => e.getBoundingClientRect().top)).toBeGreaterThanOrEqual(0);
  await expect.poll(() => canvas.evaluate(e => e.getBoundingClientRect().bottom)).toBeLessThanOrEqual(844);
  await page.evaluate(() => window.scrollTo(0, 300));
  await page.waitForTimeout(1200); // Advance several replay ticks, not just one immediate read.
  expect(await page.evaluate(() => window.scrollY)).toBe(300);
});
