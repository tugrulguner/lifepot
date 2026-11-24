import { test, expect } from "@playwright/test";
import { deflateRawSync } from "node:zlib";
import { readFileSync } from "node:fs";
const recording = readFileSync("src/game/fixtures/ca7-replay.json", "utf8");

for (const valid of [true, false]) for (const chooseStarter of [true, false]) {
  test(`pending ${valid ? "valid" : "invalid"} replay with ${chooseStarter ? "new starter" : "no action"}`, async ({page}) => {
    let apiCalls = 0;
    await page.route("**/api/**", route => { apiCalls++; return route.abort(); });
    await page.addInitScript(() => {
      const Native = window.DecompressionStream;
      let release!: () => void;
      const gate = new Promise<void>(resolve => { release = resolve; });
      Object.assign(window, { releaseReplay: release, replayWaiting: false, replayDelivered: false });
      window.DecompressionStream = class extends Native {
        constructor(format: CompressionFormat) {
          super(format);
          const output = this.readable.pipeThrough(new TransformStream({
            async flush() { Object.assign(window, { replayWaiting: true }); await gate; Object.assign(window, { replayDelivered: true }); },
          }));
          Object.defineProperty(this, "readable", { value: output });
        }
      };
    });
    // Invalid JSON still inflates successfully, so both paths cross the same barrier.
    const payload = deflateRawSync(valid ? recording : "invalid json").toString("base64url");
    await page.goto(`/experiment#replay=z1.${payload}`);
    await page.waitForFunction(() => Reflect.get(window, "replayWaiting"));
    const seed = page.getByRole("button", { name: /Seed ecosystem/ });
    if (chooseStarter) {
      await page.getByRole("button", { name: "Use a starter world instead" }).click();
      await page.getByRole("button", { name: "Preview Hunters and prey" }).click();
      await page.getByRole("button", { name: "Review this world" }).click();
      await expect(seed).toBeVisible();
    }
    await page.evaluate(async () => {
      Reflect.get(window, "releaseReplay")();
      await new Promise<void>(done => requestAnimationFrame(() => requestAnimationFrame(() => done())));
    });
    await page.waitForFunction(() => Reflect.get(window, "replayDelivered"));
    const error = page.getByText("This replay link could not be opened. You can still create your own world.");
    if (chooseStarter) {
      await expect(seed).toBeVisible();
      await expect(page.getByTestId("generation")).toHaveCount(0);
      await expect(error).toHaveCount(0);
    } else if (valid) await expect(page.getByTestId("generation")).toContainText("/ 180");
    else await expect(error).toBeVisible();
    expect(apiCalls).toBe(0);
  });
}
