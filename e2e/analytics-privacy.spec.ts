import { test, expect } from "@playwright/test";
import { gunzipSync } from "node:zlib";

const token = "phc_qXkp5FBQfrqHQwkqf3ys8iSoGoMYw2tpTHXGugXJhP8V";
const sentinel = "ANALYTICS_PRIVATE_SENTINEL";

type PostHogEvent = { event?: string; properties?: Record<string, unknown> };
function decodedPostHogEvents(bodies: string[]): PostHogEvent[] {
  return bodies.flatMap(body => {
    const value = JSON.parse(body);
    return (Array.isArray(value) ? value : value.batch ?? [value]) as PostHogEvent[];
  });
}

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
  await page.waitForTimeout(3500);
  expect(ingest).toEqual([]);
});

test("real SDK captures actual deterministic LifePot terminal completion without setup content", async ({ context, page }) => {
  test.setTimeout(120_000);
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
      const body = buffer.toString();
      JSON.parse(body);
      bodies.push(body);
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
  await expect.poll(() => decodedPostHogEvents(bodies).some(event => event.event === "lifepot_run_started")).toBe(true);
  const started = decodedPostHogEvents(bodies).find(event => event.event === "lifepot_run_started");
  expect(started?.properties).toMatchObject({ entry_method: "fresh", interpretation_mode: "fallback", event_schema_version: 1 });
  expect(JSON.stringify(decodedPostHogEvents(bodies))).not.toMatch(/Rich mineral|Predator packs|Diversify while|seed|prompt|ledger/i);
  await page.getByRole("button", { name: "3× speed" }).click();
  await expect(page.locator("section.run-status")).toContainText(/World empty|Observation complete/, { timeout: 90_000 });
  await expect.poll(() => decodedPostHogEvents(bodies).some(event => event.event === "lifepot_run_completed")).toBe(true);
  const completed = decodedPostHogEvents(bodies).find(event => event.event === "lifepot_run_completed");
  console.log("REAL_POSTHOG_TERMINAL_EVENT_PROPERTIES", JSON.stringify({ stop_reason: completed?.properties?.stop_reason, generation_bucket: completed?.properties?.generation_bucket, interpretation_mode: completed?.properties?.interpretation_mode, event_schema_version: completed?.properties?.event_schema_version, private_setup_text_absent: !/Rich mineral|Predator packs|Diversify while|seed|prompt|ledger/i.test(JSON.stringify(decodedPostHogEvents(bodies))) }));
  expect(completed?.properties).toMatchObject({ stop_reason: expect.stringMatching(/^(extinct|surviving|thriving)$/), generation_bucket: expect.any(String), interpretation_mode: "fallback", event_schema_version: 1 });
  expect(JSON.stringify(decodedPostHogEvents(bodies))).not.toMatch(/Rich mineral|Predator packs|Diversify while|seed|prompt|ledger/i);
});

test("real SDK captures setup failure from an actual failed setup request", async ({ context, page }) => {
  const bodies: string[] = [];
  let setupRequests = 0;
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
      const body = buffer.toString();
      JSON.parse(body);
      bodies.push(body);
      await route.fulfill({ status: 200, contentType: "application/json", body: '{"status":1}' });
      return;
    }
    if (url.pathname.endsWith("/api/judge") && request.method() === "POST") {
      setupRequests++;
      await route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"fixture unavailable"}' });
      return;
    }
    await route.continue();
  });
  await page.goto("/play");
  const panel = page.locator(".question-panel");
  for (let question = 0; question < 3; question++) {
    await panel.getByRole("textbox").fill(["A stable test ecosystem", "Predators may threaten grazers", "I want to observe persistence"][question]);
    await panel.getByRole("button", { name: question === 2 ? "Review ecosystem" : "Continue" }).click();
  }
  await expect(page.getByText("Deterministic fallback", { exact: true })).toBeVisible();
  expect(setupRequests).toBe(1);
  await expect.poll(() => decodedPostHogEvents(bodies).some(event => event.event === "lifepot_setup_failed")).toBe(true);
  const failed = decodedPostHogEvents(bodies).find(event => event.event === "lifepot_setup_failed");
  expect(failed?.properties).toMatchObject({ failure_category: "unknown", event_schema_version: 1 });
  expect(JSON.stringify(decodedPostHogEvents(bodies))).not.toMatch(/stable test ecosystem|Predators may threaten|persistence|fixture unavailable/i);
});
