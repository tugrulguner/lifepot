import { expect, test, type Page } from "@playwright/test";
import { defaultConfig } from "../src/game/setup";

async function completeThroughControls(page: Page) {
  await page.getByRole("button", { name: /Seed ecosystem/ }).click();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const step = page.getByRole("button", { name: "Step one generation", exact: true });
  await step.click({ trial: true });
  const control = await step.elementHandle();
  if (!control) throw new Error("Missing step control");
  const initial = Number((await page.getByTestId("generation").textContent())!.match(/^(\d+)/)![1]);
  let ticks = 0;
  for (let generation = initial; generation < 180;) {
    const action = await control.evaluate(button => {
      if (!button.isConnected) return "complete";
      if (!(button instanceof HTMLButtonElement)) throw new Error("Invalid step control");
      if (button.disabled) return "waiting";
      button.click();
      return "stepped";
    });
    if (action === "complete") break;
    if (action === "waiting") await expect(step).toBeEnabled();
    else { generation++; ticks++; }
  }
  const results = page.getByRole("region", { name: "Run results", exact: true });
  await expect(results).toBeVisible();
  const finalGeneration = Number((await page.getByTestId("generation").textContent())!.match(/^(\d+)/)![1]);
  expect(initial + ticks).toBe(finalGeneration);
  const measurements = await results.locator("tbody tr th").allTextContents();
  expect(measurements.map(Number)).toEqual(Array.from({ length: finalGeneration + 1 }, (_, generation) => generation));
}

// Native-browser integration, not a JSDOM rendering-throughput test. Keep both
// original worlds, real engine ticks, normal motion and the default deadlines.
test.describe.serial("interpreted names through complete real-engine trials", () => {
  let page: Page;
  let setupCalls = 0;
  const errors: string[] = [];
  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/api/judge", async route => {
      setupCalls++;
      const request = route.request().postDataJSON();
      expect(request.kind).toBeUndefined();
      // Explicit setup-response fixture; this does not establish live inference.
      await route.fulfill({ json: {
        config: defaultConfig(), source: "jev", requestHash: request.requestHash,
        evidence: { establishedIntent: { species: [
          { id: "A", name: "pond snails", role: "grazer" },
          { id: "B", name: "small minnows", role: "hunter" },
        ] } },
      } });
    });
  });
  test.afterAll(async () => { await page?.close(); });

  test("first completion retains both interpreted organism names", async () => {
    await page.goto("/play");
    for (const [index, value] of ["A pond with pond snails and small minnows", "Minnows eat snails", "Inherited variation"].entries()) {
      await page.getByRole("textbox").fill(value);
      await page.getByRole("button", { name: index === 2 ? "Review ecosystem" : "Continue", exact: true }).click();
    }
    await expect(page.getByText(/Established organism intent: A — pond snails/)).toBeVisible();
    await page.getByLabel("World policy").selectOption("fixed");
    await completeThroughControls(page);
    const results = page.getByRole("region", { name: "Run results", exact: true });
    await expect(results.getByRole("list", { name: "Observed outcomes" })).toContainText("pond snails");
    await expect(results.getByRole("list", { name: "Observed outcomes" })).toContainText("small minnows");
    expect(setupCalls).toBe(1);
    expect(errors).toEqual([]);
  });

  test("edited second trial retains both names in the previous-trial comparison without repeated setup inference", async () => {
    await page.getByRole("button", { name: "Edit this world", exact: true }).click();
    await page.getByText("Edit world conditions", { exact: true }).click();
    await page.getByLabel("Resource abundance").selectOption("rich");
    await completeThroughControls(page);
    const comparison = page.getByRole("region", { name: "Previous trial comparison", exact: true });
    await expect(comparison).toContainText("pond snails");
    await expect(comparison).toContainText("small minnows");
    await expect(comparison).toContainText("balanced → rich");
    expect(setupCalls).toBe(1);
    expect(errors).toEqual([]);
  });
});
