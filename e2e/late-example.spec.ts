import { expect, test } from "@playwright/test";
for (const width of [1280, 390]) test(`late example download preserves a newer paused world at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 850 });
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  let inference = 0;
  await page.route("**/api/{judge,reflect}", route => { inference++; return route.abort(); });
  await page.addInitScript(() => {
    const original = window.fetch.bind(window);
    const state = window as Window & { releaseExample?: () => void; exampleDelivered?: boolean };
    // Fault injection: a delayed transport that ignores abort. Payload is the actual bundled recording.
    window.fetch = async (input, init) => {
      if (String(input) !== "/example-world.json") return original(input, init);
      await new Promise<void>(resolve => { state.releaseExample = resolve; });
      const response = await original(input, { ...init, signal: undefined });
      const text = await response.text();
      state.exampleDelivered = true;
      return new Response(text, { status: response.status, headers: response.headers });
    };
  });
  await page.goto("/play#example");
  await page.waitForFunction(() => typeof (window as Window & { releaseExample?: () => void }).releaseExample === "function");
  await page.getByRole("button", { name: "Explore deterministic preset", exact: true }).click();
  await page.getByLabel("World policy").selectOption("fixed");
  await page.getByRole("button", { name: /Seed ecosystem/ }).click();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const before = await page.locator(".stats-strip").innerText();
  await page.evaluate(() => (window as Window & { releaseExample?: () => void }).releaseExample!());
  await page.waitForFunction(() => (window as Window & { exampleDelivered?: boolean }).exampleDelivered);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(page.getByRole("button", { name: "Resume", exact: true })).toBeVisible();
  expect(await page.locator(".stats-strip").innerText()).toBe(before);
  await expect(page.getByRole("region", { name: "Run status", exact: true })).toContainText("Fixed world rules");
  await expect(page.getByText(/Recorded example · The little pond/)).toHaveCount(0);
  await expect(page.getByText(/The example could not be loaded/)).toHaveCount(0);
  expect(inference).toBe(0); expect(errors).toEqual([]);
});
