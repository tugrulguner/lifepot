import { expect, test, type Page } from "@playwright/test";
import { deterministicSetup, hashSetupRequest } from "../src/game/setup";
import { councilSetup, councilDecision } from "./council-fixture";

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
  await page.getByRole("textbox", { name: "What should evolution favor?" }).fill(answers.reward);
  await page.keyboard.press("Enter");
}

async function expectModePotLinkFitsViewport(page: Page) {
  const link = page.getByRole("link", { name: "ModePot" });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", "https://modepot.io/");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

test("mobile simulation keeps every stat label and value inside the viewport", async ({ page }) => {
  for (const viewport of [{ width: 320, height: 390 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    await page.route("**/api/judge", (route) => route.abort());
    await page.goto("/play");
    await page.getByRole("button", { name: "Explore deterministic preset" }).click();
    await page.getByRole("button", { name: /Seed ecosystem/ }).click();
    await expect(page.getByRole("img", { name: /ecosystem generation/i })).toBeVisible();
    await expect(page.getByTestId("generation")).not.toHaveText("0 / 180", { timeout: 5_000 });
    await expect(page.locator(".stat").filter({ visible: true })).toHaveCount(viewport.width <= 760 ? 6 : 8);
    const measurements = await page.locator(".stats-strip").evaluate((strip) => {
      const bounds = (element: Element) => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, width: rect.width, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth };
      };
      return {
        viewport: innerWidth,
        root: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
        strip: bounds(strip),
        stats: Array.from(strip.querySelectorAll(".stat"))
          .filter((stat) => stat.getClientRects().length > 0)
          .map((stat) => ({
            label: bounds(stat.querySelector("span")!),
            value: bounds(stat.querySelector("strong")!),
          })),
      };
    });
    expect(measurements.root).toBeLessThanOrEqual(viewport.width);
    expect(measurements.body).toBeLessThanOrEqual(viewport.width);
    for (const stat of measurements.stats) {
      expect(stat.label.left).toBeGreaterThanOrEqual(measurements.strip.left);
      expect(stat.label.right).toBeLessThanOrEqual(measurements.strip.right);
      expect(stat.value.left).toBeGreaterThanOrEqual(measurements.strip.left);
      expect(stat.value.right).toBeLessThanOrEqual(measurements.strip.right);
    }
    await page.screenshot({ path: `test-results/simulation-${viewport.width}-running.png`, fullPage: true });
    if (viewport.width !== 1440) {
      await page.getByRole("button", { name: "Pause" }).click();
      await page.screenshot({ path: `test-results/simulation-${viewport.width}-paused.png`, fullPage: true });
    }
  }
});

test("deterministic preset enters the existing review and simulation without judge calls", async ({ page }) => {
  let judgeCalls = 0;
  await page.route("**/api/judge", async (route) => { judgeCalls += 1; await route.abort(); });
  await page.goto("/play");
  await page.getByRole("button", { name: "Explore deterministic preset" }).click();
  await expect(page.getByRole("heading", { name: "World conditions" })).toBeVisible();
  await expect(page.getByTestId("interpreter-source")).toHaveText("Deterministic fallback");
  await page.getByRole("button", { name: /Seed ecosystem/ }).click();
  await expect(page.getByRole("img", { name: /ecosystem generation/i })).toBeVisible();
  await expect(page.getByTestId("generation")).not.toHaveText("0 / 180", { timeout: 5_000 });
  expect(judgeCalls).toBe(0);
});

test("explains the bounded Jev-to-simulation flow on the first question", async ({ page }) => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 390 }, { width: 320, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.route("**/api/judge", (route) => route.abort());
    await page.goto("/play");
    await expect(page.getByText("QUESTION 1 / 3")).toBeVisible();
    await expect(page.getByRole("heading", { name: "What exists in this world?" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "What exists in this world?" })).toBeFocused();
    // Native autofocus scrolls asynchronously; assert after the browser has settled.
    await page.waitForTimeout(300);
    await page.locator(".setup-intro summary").click();
    await expect(page.getByText(/three answers.*Jev.*validated.*deterministic/i)).toBeVisible();
    await expect(page.getByText(/not a biological forecast/i)).toBeVisible();
    const about = page.getByRole("link", { name: /About LifePot/i });
    await expect(about).toHaveAttribute("href", "https://github.com/tugrulguner/lifepot/tree/main/docs");
    await expect(about).toHaveAttribute("target", "_blank");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator(".setup-intro summary").click();
    await page.getByRole("heading", { name: "What exists in this world?" }).scrollIntoViewIfNeeded();
    const headerBounds = await page.locator(".family-header").boundingBox();
    const headingBounds = await page.getByRole("heading", { name: "What exists in this world?" }).boundingBox();
    expect(headerBounds).not.toBeNull();
    expect(headingBounds).not.toBeNull();
    expect(headingBounds!.y).toBeGreaterThanOrEqual(headerBounds!.y + headerBounds!.height);
    if (viewport.height >= 600) {
      const continueButton = page.getByRole("button", { name: "Continue" });
      await expect(continueButton).toBeVisible();
      const buttonBounds = await continueButton.boundingBox();
      expect(buttonBounds).not.toBeNull();
      expect(buttonBounds!.y).toBeGreaterThanOrEqual(0);
      expect(buttonBounds!.y + buttonBounds!.height).toBeLessThanOrEqual(viewport.height);
    }
    await page.screenshot({ path: `test-results/onboarding-${viewport.width}.png`, fullPage: true });
  }
});

test("links every game stage back to ModePot on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/judge", (route) => route.abort());
  await page.goto("/play");
  await expectModePotLinkFitsViewport(page);
  await answerSetupWithKeyboard(page);
  await expectModePotLinkFitsViewport(page);
  await page.getByRole("button", { name: /Seed ecosystem/ }).click();
  await expectModePotLinkFitsViewport(page);
});

test("keyboard setup seeds a visibly advancing cellular world and pause stops it", async ({ page }) => {
  let judgeCalls = 0;
  await page.route("**/api/judge", async (route) => {
    judgeCalls += 1;
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

  await page.goto("/play");
  await answerSetupWithKeyboard(page);
  await expect(page.getByRole("heading", { name: "World conditions" })).toBeVisible();
  await expect(page.getByLabel("Validated world rules")).toContainText("Species A");
  await page.getByRole("button", { name: /Seed ecosystem/ }).click();

  const canvas = page.getByRole("img", { name: /ecosystem generation/i });
  await expect(canvas).toBeVisible();
  await expect(page.getByTestId("generation")).not.toHaveText("0 / 180", { timeout: 5_000 });
  await expect(page.getByTestId("prey")).toContainText(/\d+/);
  await expect(page.getByTestId("predators")).toContainText(/\d+/);
  await expect(page.getByTestId("births")).toContainText(/\d+/);
  await expect(page.getByTestId("deaths")).toContainText(/\d+/);
  await expect(page.getByRole("heading", { name: "World observatory" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Lineages" })).toBeVisible();
  await expect(page.getByText("Species A", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What’s changing" })).toBeVisible();
  expect(judgeCalls).toBe(1);

  await page.getByRole("button", { name: "Pause" }).click();
  const pausedAt = await page.getByTestId("generation").textContent();
  await page.waitForTimeout(700);
  await expect(page.getByTestId("generation")).toHaveText(pausedAt ?? "");
  await expect(page.getByRole("button", { name: "Resume" })).toBeVisible();
});

test("copied replay opens at generation zero and never calls the judge", async ({ page, context }) => {
  await page.route("**/api/judge", route => route.abort());
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/play");
  await answerSetupWithKeyboard(page);
  await page.getByRole("button", { name: /Seed ecosystem/ }).click();
  await page.getByRole("button", { name: "3× speed" }).click();
  await expect(page.getByRole("heading", { name: /No organisms remain|Observation complete/ })).toBeVisible({ timeout: 25_000 });
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

for (const viewport of [{ width: 1280, height: 633 }, { width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`observatory never covers the board at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.route("**/api/judge", (route) => route.abort());
    await page.clock.install();
    await page.goto("/play");
    await answerSetupWithKeyboard(page);
    await page.clock.pauseAt(new Date(Date.now() + 1000));
    await page.getByRole("button", { name: /Seed ecosystem/ }).click();
    await expect(page.getByText("Collecting history", { exact: true })).toBeVisible();
    const board = page.getByRole("img", { name: /ecosystem generation/i });
    const panel = page.getByRole("complementary", { name: "World observatory panel" });
    const boardBox = await board.boundingBox();
    const panelBox = await panel.boundingBox();
    expect(boardBox).not.toBeNull();
    expect(panelBox).not.toBeNull();
    if (!boardBox || !panelBox) throw new Error("Missing workspace surfaces");
    if (viewport.width > 1000) {
      expect(panelBox.x).toBeGreaterThanOrEqual(boardBox.x + boardBox.width);
      expect(boardBox.width).toBeGreaterThanOrEqual(300);
    } else expect(panelBox.y).toBeGreaterThanOrEqual(boardBox.y + boardBox.height);
    for (const selector of [".stats-strip", ".controls", ".ticker", ".decision-overlay", ".legend"]) {
      const box = await page.locator(selector).boundingBox();
      expect(box).not.toBeNull();
      if (!box) throw new Error(`Missing ${selector}`);
      expect(box.y + box.height <= boardBox.y || box.y >= boardBox.y + boardBox.height).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.clock.runFor(500);
    await expect(page.getByRole("img", { name: "Population history", exact: true })).toBeVisible();
    await expect(page.getByText("Collecting history", { exact: true })).toHaveCount(0);
    await page.getByRole("tab", { name: "Lineages" }).click();
    await expect(page.getByText("Heritable phenotype")).toBeVisible();
    await page.screenshot({ path: `test-results/lifepot-${viewport.width}.png`, fullPage: true });
  });
}

test("graph preview and runtime show bound species policies, not legacy cohort defaults", async ({ page }) => {
  await page.route("**/api/judge", async route => {
    const request = route.request().postDataJSON();
    return route.fulfill({ json: request.kind === "evolution" ? await councilDecision(request.summary) : await councilSetup(answers) });
  });
  await page.goto("/play");
  await answerSetupWithKeyboard(page);
  const rules = page.getByLabel("Validated world rules");
  await expect(rules).toContainText("Omnivore");
  await expect(rules).toContainText("Stability");
  await expect(rules).toContainText("neutral");
  await page.getByRole("button", { name: /Seed ecosystem/ }).click();
  await page.getByRole("button", { name: "3× speed" }).click();
  const policies = page.getByLabel("Species birth policies");
  await expect(policies).toContainText("Next births: Armored", { timeout: 15000 });
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(policies).toContainText("Next births: Pursuit");
  await expect(policies).toContainText("Species B · Omnivore");
  await expect(policies).not.toContainText("Next births: Ambush");
  await page.screenshot({ path: "test-results/lifepot-species-policies.png", fullPage: true });
});

test("setup continues safely when the interpreter is offline", async ({ page }) => {
  await page.route("**/api/judge", (route) => route.abort());
  await page.goto("/play");
  await answerSetupWithKeyboard(page);
  await expect(page.getByRole("heading", { name: "World conditions" })).toBeVisible();
  await expect(page.getByLabel("Validated world rules")).toContainText("Species A");
});
