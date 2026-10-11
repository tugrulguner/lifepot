import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { decodeReplay, playReplay } from "../src/game/replay";

// Exercise the installed analytics SDK while intercepting every request; never
// send synthetic gameplay or sentinel text to the production project.
test.use({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36" });
async function interceptAnalytics(page: Page) {
  const events: Array<{ event: string; properties?: Record<string, unknown> }> = [];
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    Object.defineProperty(navigator, "userAgentData", { get: () => ({ brands: [{ brand: "Chromium", version: "130" }], mobile: false, platform: "macOS" }) });
  });
  await page.exposeFunction("recordPostHogBeacon", (base64: string) => {
    const body = Buffer.from(base64, "base64");
    const text = body[0] === 0x1f && body[1] === 0x8b ? gunzipSync(body).toString() : body.toString();
    const payload = JSON.parse(text);
    const batch = Array.isArray(payload) ? payload : payload.batch ?? [payload];
    for (const event of batch) if (event?.event) events.push(event);
  });
  await page.addInitScript(() => {
    const original = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (url, data) => {
      if (!String(url).includes("posthog.com")) return original(url, data);
      void new Blob([data as BlobPart]).arrayBuffer().then(buffer => {
        let binary = ""; for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte);
        return (window as unknown as { recordPostHogBeacon: (base64: string) => Promise<void> }).recordPostHogBeacon(btoa(binary));
      });
      return true;
    };
  });
  await page.context().route("**/*posthog.com/**", async route => {
    const request = route.request(), body = request.postDataBuffer();
    if (body && /\/e\/?|\/capture\/?/.test(new URL(request.url()).pathname)) {
      let text = body.toString();
      if (body[0] === 0x1f && body[1] === 0x8b) text = gunzipSync(body).toString();
      let payload: unknown;
      try { payload = JSON.parse(text); } catch {
        const data = new URLSearchParams(text).get("data");
        if (data) payload = JSON.parse(Buffer.from(data, "base64").toString());
      }
      const batch = Array.isArray(payload) ? payload : payload && typeof payload === "object" && "batch" in payload ? (payload as { batch: unknown[] }).batch : [payload];
      for (const event of batch) if (event && typeof event === "object" && "event" in event) events.push(event as { event: string; properties?: Record<string, unknown> });
      await route.fulfill({ status: 200, body: "1", contentType: "text/plain" });
    } else {
      const config = { featureFlags: {}, featureFlagPayloads: {}, autocapture: true, autocapture_opt_out: false, sessionRecording: false, hasFeatureFlags: false, supportedCompression: ["gzip", "gzip-js"] };
      if (new URL(request.url()).pathname.endsWith("/config.js")) {
        const token = new URL(request.url()).pathname.split("/").at(-2)!;
        await route.fulfill({ status: 200, contentType: "application/javascript", body: `window._POSTHOG_REMOTE_CONFIG = {...(window._POSTHOG_REMOTE_CONFIG || {}), ${JSON.stringify(token)}: {config: ${JSON.stringify(config)}}};` });
      } else await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(config) });
    }
  });
  return events;
}

test("My Worlds persists, exports/imports, replays exactly and links a reviewed follow-up without uploading private text", async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  let judgeCalls = 0;
  await page.route("**/api/judge**", async route => { judgeCalls++; await route.abort(); });
  const analytics = await interceptAnalytics(page);
  await page.setViewportSize({ width: 390, height: 850 });
  await page.goto("/play");
  await page.getByRole("button", { name: "Explore deterministic preset" }).click();
  await page.getByLabel("World policy").selectOption("fixed");
  await page.getByLabel("Your question or prediction (optional)").fill("PRIVATE_QUESTION_SENTINEL");
  await page.getByRole("button", { name: /Seed ecosystem/ }).click();
  await page.getByRole("button", { name: "3× speed" }).click();
  await expect(page.getByRole("region", { name: "Run results" })).toBeVisible({ timeout: 100_000 });
  await page.getByLabel("Optional world name (stored locally)").fill("PRIVATE_NAME_SENTINEL");
  await page.getByRole("button", { name: "Save completed world" }).click();
  const panel = page.getByRole("region", { name: "My Worlds — browser-local saves" });
  await expect(panel.getByRole("status")).toHaveText("World saved in this browser.");
  const downloadPromise = page.waitForEvent("download");
  await panel.getByRole("button", { name: "Export", exact: true }).click();
  const download = await downloadPromise;
  const exportPath = testInfo.outputPath("world.lifepot.json"); await download.saveAs(exportPath);
  const exported = await readFile(exportPath, "utf8");
  expect(exported).not.toContain("PRIVATE_QUESTION_SENTINEL");
  const record = JSON.parse(exported), recording = decodeReplay(record.replay), replayed = await playReplay(recording);
  expect(replayed.state.outcome).toBe(record.outcome);
  expect(replayed.state.generation).toBe(record.evidence.samples.at(-1).generation);
  expect(replayed.state.stats.population).toBe(record.evidence.samples.at(-1).population);
  expect(record.policy).toBe("fixed"); expect(record.parentId).toBeNull();
  for (const viewport of [{ width: 1280, height: 850 }, { width: 768, height: 850 }, { width: 390, height: 850 }, { width: 320, height: 850 }]) {
    await page.setViewportSize(viewport);
    await panel.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.screenshot({ path: testInfo.outputPath(`saved-world-${viewport.width}.png`) });
  }
  await page.reload();
  await expect(panel.getByText("PRIVATE_NAME_SENTINEL", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/play$/);
  await panel.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(panel.getByText("PRIVATE_NAME_SENTINEL", { exact: true })).toHaveCount(0);
  await page.getByLabel("Import a LifePot world export").setInputFiles(exportPath);
  await expect(panel.getByText("PRIVATE_NAME_SENTINEL", { exact: true })).toBeVisible();
  await panel.getByRole("button", { name: "Reopen and replay" }).click();
  await expect(page.getByText(/Exact recorded replay/)).toBeVisible();
  await expect(page).toHaveURL(/\/play$/);
  await expect(page.getByRole("region", { name: "Run results" })).toBeVisible({ timeout: 100_000 });
  await expect(page.getByRole("img", { name: new RegExp(`Ecosystem generation ${replayed.state.generation}; ${replayed.state.stats.population} organisms`) })).toBeVisible();
  await expect(page.getByRole("region", { name: "Run status" })).not.toContainText("PRIVATE_QUESTION_SENTINEL");
  await panel.getByRole("button", { name: "Review changed experiment" }).click();
  await expect(page.getByLabel("World policy")).toHaveValue("fixed");
  await expect(page.getByLabel("Your question or prediction (optional)")).toHaveValue("");
  await expect(page.getByRole("region", { name: "Run status" })).toHaveCount(0);
  await page.getByText("Edit world conditions", { exact: true }).click();
  const resource = page.getByLabel("Resource abundance");
  await resource.selectOption(recording.config.environment.abundance === "rich" ? "scarce" : "rich");
  await page.getByRole("button", { name: /Seed ecosystem/ }).click();
  await expect(page.getByRole("region", { name: "Run results" })).toBeVisible({ timeout: 100_000 });
  await page.getByLabel("Optional world name (stored locally)").fill("Follow-up pond");
  await page.getByRole("button", { name: "Save completed world" }).click();
  await expect(panel.getByText("Follow-up pond", { exact: true })).toBeVisible();
  await expect(panel.getByText(/Follow-up to PRIVATE_NAME_SENTINEL\. Changed conditions:/)).toBeVisible();
  await expect.poll(() => analytics.filter(event => event.event === "$pageview").length).toBeGreaterThan(0);
  expect(JSON.stringify(analytics)).not.toContain("PRIVATE_NAME_SENTINEL");
  expect(JSON.stringify(analytics)).not.toContain("PRIVATE_QUESTION_SENTINEL");
  expect(judgeCalls).toBe(0); expect(errors).toEqual([]);
});

test("actual analytics pageviews/pageleaves strip replay-bearing URL parts", async ({ page }) => {
  const analytics = await interceptAnalytics(page);
  await page.goto("/play?world=PRIVATE_QUERY_SENTINEL#PRIVATE_FRAGMENT_SENTINEL");
  await expect.poll(() => analytics.filter(event => event.event === "$pageview").length).toBeGreaterThan(0);
  // Trigger the real SDK's lifecycle handler without navigation destroying the
  // asynchronous test-only beacon inspector before it can decode the payload.
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: false })));
  await expect.poll(() => analytics.filter(event => event.event === "$pageleave").length).toBeGreaterThan(0);
  expect(JSON.stringify(analytics)).not.toContain("PRIVATE_QUERY_SENTINEL");
  expect(JSON.stringify(analytics)).not.toContain("PRIVATE_FRAGMENT_SENTINEL");
});

test("return visit exposes saved history and restores archived highlights, child context, and parent comparison", async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  let judgeCalls = 0; await page.route("**/api/judge**", async route => { judgeCalls++; await route.abort(); });
  const analytics = await interceptAnalytics(page);
  await page.setViewportSize({ width: 390, height: 850 });
  await page.goto("/play");
  const pond = testInfo.outputPath("pond-notebook.json"), child = testInfo.outputPath("follow-up-pond.json");
  await readFile(new URL("./fixtures/my-worlds/pond-notebook.json", import.meta.url)).then(data => import("node:fs/promises").then(fs => fs.writeFile(pond, data)));
  await readFile(new URL("./fixtures/my-worlds/follow-up-pond.json", import.meta.url)).then(data => import("node:fs/promises").then(fs => fs.writeFile(child, data)));
  await page.getByLabel("Import a LifePot world export").setInputFiles(pond);
  await expect(page.getByRole("status")).toContainText("World imported");
  await page.getByLabel("Import a LifePot world export").setInputFiles(child);
  await expect(page.getByRole("status")).toContainText("World imported");
  await page.reload();
  const shortcut = page.getByRole("button", { name: "My Worlds (2)" });
  await expect(shortcut).toBeVisible();
  await expect(page.getByRole("heading", { name: "What exists in this world?" })).toBeVisible();
  await shortcut.click();
  const shelf = page.getByRole("region", { name: "My Worlds — browser-local saves" });
  await expect(shelf.getByText("Pond notebook", { exact: true })).toBeVisible();
  await expect(shelf.getByText(/Follow-up to Pond notebook\. Changed conditions:.*Resource abundance/i)).toBeVisible();
  await expect(shelf.getByText(/algae producers|snails|fish/i).first()).toBeVisible();
  await shelf.getByRole("listitem").filter({ hasText: "extinct at generation 38" }).getByRole("button", { name: "Reopen and replay" }).click();
  await expect(page.getByRole("region", { name: "Recorded highlights" })).toContainText("Founder family 29 disappeared at generation 85 (recorded)");
  await expect(page.getByRole("region", { name: "Run status" })).toContainText("Experiment: Pond notebook");
  await expect(page.getByRole("region", { name: "Run status" })).toContainText("Exact recorded replay · no inference");
  await page.getByRole("button", { name: "3× speed" }).click();
  await expect(page.getByRole("region", { name: "Run results" })).toBeVisible({ timeout: 100_000 });
  await expect(page.getByRole("region", { name: "Recorded highlights" })).toContainText("generation 85");
  const resultsShelf = page.getByRole("region", { name: "My Worlds — browser-local saves" });
  await resultsShelf.getByRole("listitem").filter({ hasText: "Follow-up to Pond notebook. Changed conditions:" }).getByRole("button", { name: "Reopen and replay" }).click();
  await expect(page.getByRole("region", { name: "Run status" })).toContainText("Experiment: Follow-up pond");
  await expect(page.getByRole("region", { name: "Run results" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("region", { name: "Previous trial comparison" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Previous trial comparison" })).toContainText("Changed conditions");
  const finalShelf = page.getByRole("region", { name: "My Worlds — browser-local saves" });
  await finalShelf.getByRole("listitem").filter({ hasText: "extinct at generation 38" }).getByRole("button", { name: "Delete", exact: true }).click();
  await expect(finalShelf.getByText(/Saved world deleted/)).toBeVisible();
  await finalShelf.getByRole("listitem").filter({ hasText: "Follow-up to a previous saved world (not stored here)" }).getByRole("button", { name: "Reopen and replay" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved follow-up parent is missing" })).toBeVisible();
  expect(judgeCalls).toBe(0); expect(errors).toEqual([]);
  expect(JSON.stringify(analytics)).not.toContain("Pond notebook");
});
