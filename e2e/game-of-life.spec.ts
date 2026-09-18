import { expect, test, type Page } from "@playwright/test";
import { hashSetupRequest } from "../src/game/setup";

const answers = {
  world: "Rich mineral pools clustered in a few oases",
  threat: "Toxic waves sweep across the world in pulses",
  reward: "Replicate quickly, even if individuals live shorter lives.",
};

async function answerSetupWithKeyboard(page: Page) {
  await page.getByRole("textbox", { name: "What exists in this world?" }).fill(answers.world);
  await page.keyboard.press("Enter");
  await page.getByRole("textbox", { name: "What threatens life here?" }).fill(answers.threat);
  await page.keyboard.press("Enter");
  await page.getByRole("textbox", { name: "What should life be rewarded for?" }).fill(answers.reward);
  await page.keyboard.press("Enter");
}

test("keyboard setup seeds a visibly advancing cellular world and pause stops it", async ({ page }) => {
  let judgeCalls = 0;
  await page.route("**/api/judge", async (route) => {
    judgeCalls += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        config: {
          environment: { abundance: "rich", distribution: "clustered", hazard: "toxin", volatility: "pulsing" },
          fitness: { survive: 0.1, replicate: 0.6, cooperate: 0.1, explore: 0.1, adapt: 0.1 },
        },
        source: "fallback",
        requestHash: hashSetupRequest(answers),
      }),
    });
  });

  await page.goto("/");
  await answerSetupWithKeyboard(page);
  await expect(page.getByRole("heading", { name: "World conditions" })).toBeVisible();
  await expect(page.getByText("RICH · CLUSTERED · TOXIN PULSES")).toBeVisible();
  await page.getByRole("button", { name: "Seed life" }).click();

  const canvas = page.getByRole("img", { name: /cellular world/i });
  await expect(canvas).toBeVisible();
  await expect(page.getByTestId("generation")).not.toHaveText("0 / 180", { timeout: 5_000 });
  await expect(page.getByTestId("population")).toContainText(/\d+/);
  await expect(page.getByTestId("births")).toContainText(/\d+/);
  expect(judgeCalls).toBe(1);

  await page.getByRole("button", { name: "Pause" }).click();
  const pausedAt = await page.getByTestId("generation").textContent();
  await page.waitForTimeout(700);
  await expect(page.getByTestId("generation")).toHaveText(pausedAt ?? "");
  await expect(page.getByRole("button", { name: "Resume" })).toBeVisible();
});

test("copied replay opens at generation zero and never calls the judge", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await answerSetupWithKeyboard(page);
  await page.getByRole("button", { name: "Seed life" }).click();
  await page.getByRole("button", { name: "3× speed" }).click();
  await expect(page.getByRole("heading", { name: /Extinct|Surviving|Thriving/ })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Copy challenge link" }).click();
  const replayUrl = await page.evaluate(() => navigator.clipboard.readText());
  expect(replayUrl).toContain("?replay=");

  let replayJudgeCalls = 0;
  const replayPage = await context.newPage();
  await replayPage.route("**/api/judge", async (route) => {
    replayJudgeCalls += 1;
    await route.abort();
  });
  await replayPage.goto(replayUrl);
  await expect(replayPage.getByTestId("generation")).toHaveText("0 / 180");
  await expect(replayPage.getByRole("img", { name: /cellular world/i })).toBeVisible();
  await expect(replayPage.getByTestId("generation")).not.toHaveText("0 / 180", { timeout: 5_000 });
  expect(replayJudgeCalls).toBe(0);
});

test("setup continues safely when the interpreter is offline", async ({ page }) => {
  await page.route("**/api/judge", (route) => route.abort());
  await page.goto("/");
  await answerSetupWithKeyboard(page);
  await expect(page.getByRole("heading", { name: "World conditions" })).toBeVisible();
  await expect(page.getByText("RICH · CLUSTERED · TOXIN PULSES")).toBeVisible();
});
