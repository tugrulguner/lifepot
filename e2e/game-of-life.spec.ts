import { expect, test, type Page } from "@playwright/test";
import { deterministicSetup, hashSetupRequest } from "../src/game/setup";

const answers = {
  world: "Rich mineral pools clustered in a few oases",
  threat: "Toxic waves sweep across the world in pulses",
  reward: "Replicate quickly, even if individuals live shorter lives.",
};

async function answerQuestion(page: Page, name: string, answer: string, nextName?: string) {
  const input = page.getByRole("textbox", { name });
  await input.fill(answer);
  await expect(input).toHaveValue(answer);
  await input.press("Enter");
  if (nextName) await expect(page.getByRole("textbox", { name: nextName })).toBeVisible();
}

async function answerSetupWithKeyboard(page: Page) {
  await answerQuestion(page, "What exists in this world?", answers.world, "What threatens life here?");
  await answerQuestion(page, "What threatens life here?", answers.threat, "What should evolution favor?");
  await answerQuestion(page, "What should evolution favor?", answers.reward);
}

test("publishes canonical SEO and discovery endpoints without mobile overflow", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://lifepot.modepot.io");
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", "https://lifepot.modepot.io");
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary");
  const jsonLd = await page.locator('script[type="application/ld+json"]').textContent();
  expect(JSON.parse(jsonLd ?? "{}").name).toBe("LifePot");
  expect(await page.request.get("/robots.txt").then((r) => r.text())).toContain("Sitemap: https://lifepot.modepot.io/sitemap.xml");
  expect(await page.request.get("/sitemap.xml").then((r) => r.text())).toContain("https://lifepot.modepot.io/");
  expect(await page.request.get("/llms.txt").then((r) => r.text())).toContain("Replaying a challenge");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("textbox", { name: "What exists in this world?" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

 test("keyboard setup seeds a visibly advancing cellular world and pause stops it", async ({ page }) => {
  let setupCalls = 0;
  await page.route("**/api/judge", async (route) => {
    const request = route.request().postDataJSON();
    if (request.kind === "evolution") return route.abort();
    setupCalls += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        config: deterministicSetup(answers),
        source: "fallback",
        requestHash: hashSetupRequest(answers),
      }),
    });
  });

  await page.goto("/");
  await answerSetupWithKeyboard(page);
  await expect(page.getByRole("heading", { name: "World conditions" })).toBeVisible();
  await expect(page.locator(".environment-code")).toHaveText("rich · clustered · toxin · balanced");
  await page.getByRole("button", { name: /Seed ecosystem/ }).click();

  const canvas = page.getByRole("img", { name: /ecosystem generation/i });
  await expect(canvas).toBeVisible();
  await expect(page.getByTestId("generation")).not.toHaveText("0 / 180", { timeout: 5_000 });
  await expect(page.getByTestId("prey")).toContainText(/\d+/);
  await expect(page.getByTestId("predators")).toContainText(/\d+/);
  await expect(page.getByTestId("species")).toContainText(/\d+/);
  expect(setupCalls).toBe(1);

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
  await page.getByRole("button", { name: /Seed ecosystem/ }).click();
  await page.getByRole("button", { name: "3× speed" }).click();
  await expect(page.getByRole("heading", { name: /Extinct|Surviving|Thriving/ })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Copy challenge link" }).click();
  const replayUrl = await page.evaluate(() => navigator.clipboard.readText());
  expect(replayUrl).toContain("#replay=");

  let replayJudgeCalls = 0;
  const replayPage = await context.newPage();
  await replayPage.route("**/api/judge", async (route) => {
    replayJudgeCalls += 1;
    await route.abort();
  });
  await replayPage.goto(replayUrl);
  await expect(replayPage.getByTestId("generation")).toHaveText("0 / 180");
  await expect(replayPage.getByRole("img", { name: /ecosystem generation/i })).toBeVisible();
  await expect(replayPage.getByTestId("generation")).not.toHaveText("0 / 180", { timeout: 5_000 });
  expect(replayJudgeCalls).toBe(0);
});

test("setup continues safely when the interpreter is offline", async ({ page }) => {
  await page.route("**/api/judge", (route) => route.abort());
  await page.goto("/");
  await answerSetupWithKeyboard(page);
  await expect(page.getByRole("heading", { name: "World conditions" })).toBeVisible();
  await expect(page.getByTestId("interpreter-source")).toContainText("Deterministic fallback");
  await expect(page.locator(".environment-code")).toHaveText("rich · clustered · toxin · balanced");
});
