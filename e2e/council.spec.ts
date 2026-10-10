import { expect, test } from "@playwright/test";
import { councilSetup, councilDecision } from "./council-fixture";
import { createSimulation } from "../src/game/world";
import { runFreshWithDecisions } from "../src/game/runtime";
import { createReplay, encodeReplay } from "../src/game/replay";
import { hashSetupRequest } from "../src/game/setup";

test("incomplete council falls back atomically in the browser", async ({ page }) => {
  await page.route("**/api/judge", async route => {
    const request = route.request().postDataJSON();
    if (request.kind !== "evolution") return route.fulfill({ json: await councilSetup(request.answers) });
    const decision = await councilDecision(request.summary);
    decision.council!.members.pop();
    return route.fulfill({ json: decision });
  });
  await page.goto("/play");
  for (const answer of ["Rich scattered minerals", "Stable environment", "Coexist and replicate"]) {
    await page.getByRole("textbox").fill(answer);
    await page.keyboard.press("Enter");
  }
  await page.getByRole("button", { name: /Seed ecosystem/ }).click();
  await page.getByRole("button", { name: "3× speed" }).click();
  await expect(page.getByLabel("Runtime council")).toContainText("Council abstained", { timeout: 15000 });
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByLabel("Species birth policies")).not.toContainText("Next births");
  await expect(page.getByLabel("Runtime council")).not.toContainText("Reconciled patch owner");
});

test("exact council replay and restart never call the API", async ({ page }) => {
  test.setTimeout(60000); // Includes a complete populated-world replay with event rendering.
  const answers = { world: "Rich scattered minerals", threat: "Stable environment", reward: "Coexist and replicate" };
  const { config } = await councilSetup(answers);
  const seed = 81;
  const { ledger } = await runFreshWithDecisions(createSimulation({ seed, config }), answers, councilDecision);
  const replay = createReplay({ answers, config, seed, requestHash: hashSetupRequest(answers), ledger });
  let calls = 0;
  await page.route("**/api/judge", route => { calls++; return route.abort(); });
  await page.goto(`/#replay=${encodeReplay(replay)}`);
  await page.getByRole("button", { name: "3× speed" }).click();
  await expect(page.getByLabel("Runtime council")).toContainText("runtime_orchestrator", { timeout: 15000 });
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByLabel("Runtime council")).toContainText("zero live API calls");
  await page.getByRole("button", { name: "Restart replay", exact: true }).click();
  await expect(page.getByTestId("generation")).toHaveText("0 / 180");
  await expect(page.getByLabel("Runtime council")).toContainText("No runtime judgment yet");
  await expect(page.getByLabel("Runtime council")).toContainText("runtime_orchestrator", { timeout: 15000 });
  await expect(page.getByRole("heading", { name: /No organisms remain|Observation complete/ })).toBeVisible({ timeout: 40000 });
  await expect(page.getByText("Replay ledger verification failed", { exact: true })).toHaveCount(0);
  expect(calls).toBe(0);
});

for (const width of [1280, 390]) test(`council provenance and reconciled changes at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 });
  await page.route("**/api/judge", async route => {
    const request = route.request().postDataJSON();
    return route.fulfill({ json: request.kind === "evolution" ? await councilDecision(request.summary) : await councilSetup(request.answers) });
  });
  await page.goto("/play");
  for (const answer of ["Rich scattered minerals", "Stable environment", "Coexist and replicate"]) {
    await page.getByRole("textbox").fill(answer);
    await page.keyboard.press("Enter");
  }
  const setup = page.getByLabel("Setup council");
  await expect(setup).toContainText("6 specialists");
  await expect(setup).toContainText("setup_orchestrator");
  await expect(setup).toContainText("predation spike");
  await page.getByText("Validated mechanics and original setup evidence", { exact: true }).click();
  await setup.getByText("Setup orchestrator provenance", { exact: true }).click();
  await expect(setup.getByText("setup_orchestrator", { exact: true })).toBeVisible();
  await expect(page.getByTestId("interpreter-source")).toContainText("Jev API");
  await page.getByRole("button", { name: /Seed ecosystem/ }).click();
  await page.getByRole("button", { name: "3× speed" }).click();
  await page.getByText("Jev input, policies & council evidence", { exact: true }).click();
  const runtime = page.getByLabel("Runtime council");
  await expect(runtime).toContainText("runtime_orchestrator", { timeout: 15000 });
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(runtime).toContainText("self_B · skip");
  await expect(runtime).toContainText("Reconciled patch owner: self_A");
  await runtime.locator("summary").filter({ hasText: /^pair_A_B · active/ }).click();
  await expect(runtime.getByText("Advisory only · not applied", { exact: true })).toBeVisible();
  await runtime.locator("summary").filter({ hasText: /^value: a consumes b/ }).click();
  await expect(runtime.getByText(/a consumes b 90%/)).toBeVisible();
  await expect(runtime).toContainText("confidence 90%");
  await expect(runtime).toContainText("17 input / 9 output tokens");
  await expect(page.getByLabel("Species birth policies")).toContainText("Next births: Armored");
  await page.getByRole("tab", { name: "Timeline" }).click();
  await expect(page.getByLabel("World observatory panel")).toContainText("Species A self interaction → cooperative");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/council-${width}.png`, fullPage: true });
});
