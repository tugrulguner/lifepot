import { expect, test } from "@playwright/test";

// The development server cannot exercise the deployment adapter's bootstrap.
// Invalid inputs must be rejected before any provider invocation or quota spend.
test.describe("built Worker dynamic runtime", () => {
  test.skip(process.env.LIFEPOT_WORKER_DELIVERY !== "1", "Requires the built deployment Worker");

  test("unprepared pages and documentation downloads keep their 404 responses", async ({ request }) => {
    const page = await request.get("/worker-runtime-missing-page");
    expect(page.status()).toBe(404);
    expect(await page.text()).toContain("not-found-content");
    const download = await request.get("/project-docs/not-a-document/markdown");
    expect(download.status()).toBe(404);
  });

  for (const endpoint of ["judge", "player-proposal", "reflect"]) {
    test(`${endpoint} validates malformed input without entering inference`, async ({ request }) => {
      for (const data of ["{}", "{"]) {
        const response = await request.post(`/api/${endpoint}`, {
          data,
          headers: { "Content-Type": "application/json" },
        });
        expect(response.status()).toBe(400);
        expect(response.headers()["content-type"]).toContain("application/json");
        expect((await response.json()).error).toEqual(expect.any(String));
      }
    });
  }
});
