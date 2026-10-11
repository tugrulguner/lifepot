import { test, expect } from "@playwright/test";
import { gunzipSync } from "node:zlib";

const token = "phc_qXkp5FBQfrqHQwkqf3ys8iSoGoMYw2tpTHXGugXJhP8V";
const sentinel = "ANALYTICS_PRIVATE_SENTINEL";

test.use({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36" });

test("real SDK keeps replay, campaign and persisted acquisition data out of every outgoing request", async ({ context, page }) => {
  const bodies: { path: string; body: string }[] = [];
  await context.addInitScript(({ token, sentinel }) => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    Object.defineProperty(navigator, "userAgentData", { get: () => ({ brands: [{ brand: "Google Chrome", version: "140" }, { brand: "Chromium", version: "140" }], mobile: false, platform: "macOS", getHighEntropyValues: async () => ({ brands: [{ brand: "Google Chrome", version: "140" }], mobile: false, platform: "macOS" }) }) });
    const key = `ph_${token}_posthog`;
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ distinct_id: "privacy-fixture", $device_id: "privacy-fixture", $initial_utm_source: sentinel, $initial_current_url: `https://lifepot.modepot.io/play?private=${sentinel}#replay=${sentinel}`, $initial_referrer: `https://source.example/path?private=${sentinel}#private`, $referrer: `https://source.example/path?private=${sentinel}` }));
  }, { token, sentinel });
  await context.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.hostname.includes("posthog.com") && request.method() === "POST") {
      let buffer = request.postDataBuffer() ?? Buffer.alloc(0);
      try { buffer = gunzipSync(buffer); } catch { /* Uncompressed JSON is also supported. */ }
      bodies.push({ path: url.pathname, body: buffer.toString() });
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: 1, featureFlags: {}, featureFlagPayloads: {} }) });
      return;
    }
    if (url.pathname.startsWith("/api/")) { await route.abort(); return; }
    await route.continue();
  });
  await page.goto(`/play?private=${sentinel}&utm_source=${sentinel}&gclid=${sentinel}#private=${sentinel}`);
  await expect.poll(() => bodies.some(row => row.body.includes("$pageview"))).toBe(true);
  // A full document navigation also flushes the previous page's leave event.
  await page.goto("/learn");
  await expect.poll(() => bodies.filter(row => row.body.includes("$pageview")).length).toBeGreaterThanOrEqual(2);
  await page.locator('a[href="/learn/quick-start"]').first().click();
  await expect(page).toHaveURL(/\/learn\/quick-start$/);
  await expect.poll(() => bodies.some(row => row.body.includes('"$pathname":"/learn/quick-start"'))).toBe(true);
  const events = bodies.flatMap(row => {
    const decoded = JSON.parse(row.body);
    return Array.isArray(decoded) ? decoded : decoded.batch ?? [decoded];
  });
  expect(events.filter(event => event.event === "$pageview" && event.properties.$pathname === "/learn/quick-start")).toHaveLength(1);
  expect(bodies.some(row => row.path.includes("flags"))).toBe(false);
  expect(JSON.stringify(bodies)).not.toContain(sentinel);
  expect(bodies.some(row => row.body.includes("$autocapture"))).toBe(false);
  expect(bodies.some(row => row.body.includes("$snapshot"))).toBe(false);
});

test("real SDK respects an existing browser capture opt-out", async ({ context, page }) => {
  const ingest: string[] = [];
  await context.addInitScript((token) => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    Object.defineProperty(navigator, "userAgentData", { get: () => ({ brands: [{ brand: "Google Chrome", version: "140" }], mobile: false, platform: "macOS", getHighEntropyValues: async () => ({ brands: [{ brand: "Google Chrome", version: "140" }], mobile: false, platform: "macOS" }) }) });
    localStorage.setItem(`__ph_opt_in_out_${token}`, "0");
    document.cookie = `__ph_opt_in_out_${token}=0; path=/`;
  }, token);
  await context.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.hostname.includes("posthog.com") && request.method() === "POST") {
      ingest.push(url.pathname);
      await route.fulfill({ status: 200, contentType: "application/json", body: '{"status":1}' });
      return;
    }
    await route.continue();
  });
  await page.goto("/learn", { waitUntil: "networkidle" });
  // Cover the SDK's normal three-second event batching interval.
  await page.waitForTimeout(3500);
  expect(ingest).toEqual([]);
});


test("real SDK captures actual deterministic LifePot run start without setup content", async ({ context, page }) => {
  const bodies: string[] = [];
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    Object.defineProperty(navigator, "userAgentData", { get: () => ({ brands: [{ brand: "Google Chrome", version: "140" }, { brand: "Chromium", version: "140" }], mobile: false, platform: "macOS", getHighEntropyValues: async () => ({ brands: [{ brand: "Google Chrome", version: "140" }], mobile: false, platform: "macOS" }) }) });
  });
  await context.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.hostname.includes("posthog.com") && request.method() === "POST") {
      let buffer = request.postDataBuffer() ?? Buffer.alloc(0);
      try { buffer = gunzipSync(buffer); } catch { /* JSON bodies need no decompression. */ }
      bodies.push(buffer.toString());
      await route.fulfill({ status: 200, contentType: "application/json", body: '{"status":1}' });
      return;
    }
    if (url.pathname.startsWith("/api/")) { await route.abort(); return; }
    await route.continue();
  });
  await page.goto("/play");
  await page.getByRole("button", { name: /Explore deterministic preset/ }).click();
  await page.getByRole("button", { name: /Seed ecosystem/ }).click();
  await expect(page.getByRole("status").filter({ hasText: /Running|Waiting for a bounded/ })).toBeVisible();
  await expect.poll(() => bodies.some(body => body.includes('"event":"lifepot_run_started"'))).toBe(true);
  const decoded = bodies.flatMap(body => { const value = JSON.parse(body); return Array.isArray(value) ? value : value.batch ?? [value]; });
  const started = decoded.find(event => event.event === "lifepot_run_started");
  expect(started?.properties).toMatchObject({ entry_method: "fresh", interpretation_mode: "fallback", event_schema_version: 1 });
  expect(JSON.stringify(decoded)).not.toMatch(/Rich mineral|Predator packs|Diversify while|seed|prompt|ledger/i);
});
