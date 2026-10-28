import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.skip(process.env.LIFEPOT_WORKER_DELIVERY !== "1", "Requires the built Cloudflare delivery Worker");

test("all prepared routes and client-navigation payloads retain their exact build bytes", async ({ request }) => {
  const routes = JSON.parse(await readFile(".open-next/delivery-manifest.json", "utf8")) as Record<string, { asset: string; rsc?: string; segments?: Record<string, string>; headers: Record<string, string> }>;
  expect(routes["/"]).toBeDefined();
  expect(routes["/play"]).toBeDefined();
  expect(routes["/project-docs/readme"]).toBeDefined();
  for (const [path, route] of Object.entries(routes)) {
    const variants: { asset: string; headers: Record<string, string> }[] = [{ asset: route.asset, headers: {} }, ...(route.rsc ? [{ asset: route.rsc, headers: { RSC: "1" } }] : []), ...Object.entries(route.segments ?? {}).map(([segment, asset]) => ({ asset, headers: { RSC: "1", "Next-Router-Segment-Prefetch": segment } }))];
    for (const variant of variants) {
      const response = await request.get(path, { headers: variant.headers });
      expect(response.status(), path).toBe(200);
      expect((await response.body()).equals(await readFile(`.open-next/assets${variant.asset}`)), path).toBe(true);
      if ("RSC" in variant.headers) expect(response.headers()["content-type"]).toBe("text/x-component");
      for (const [name, value] of Object.entries(route.headers)) {
        if (name !== "content-type" || !("RSC" in variant.headers)) expect(response.headers()[name], `${path}: ${name}`).toBe(value);
      }
    }
    const head = await request.head(path);
    expect(head.status(), path).toBe(200);
    expect((await head.body()).length).toBe(0);
  }
});

test("prepared RSC supports real client navigation from overview through docs to the game", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator(".overview-actions")).toBeVisible();
  await page.evaluate(() => { Object.assign(window, { deliveryNavigationSentinel: "same-document" }); });
  await page.locator(".overview-actions").getByRole("link", { name: "Documentation", exact: true }).click();
  await expect(page.getByRole("heading", { name: "LifePot documentation", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Play the game", exact: true }).click();
  await expect(page.getByRole("button", { name: "Explore deterministic preset", exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { deliveryNavigationSentinel?: string }).deliveryNavigationSentinel)).toBe("same-document");
  expect(errors).toEqual([]);
});
