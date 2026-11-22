import { expect, test } from "@playwright/test";

test("homepage has no video elements or media requests and offers direct play routes", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", request => requests.push(request.url()));
  await page.goto("/");
  await expect(page.locator("video, audio, source[src$='.mp4']")).toHaveCount(0);
  expect(requests.some(url => /\.mp4(?:\?|$)/i.test(url))).toBe(false);
  await expect(page.getByRole("link", { name: "Play LifePot" })).toHaveAttribute("href", "/experiment");
  await expect(page.locator(".overview-actions a[href='/play#example']")).toHaveCount(1);
});
