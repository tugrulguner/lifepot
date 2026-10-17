import { expect, test } from "@playwright/test";

for (const width of [390, 1280]) test(`explained demo is on demand and playable at ${width}px`, async ({ page, request }, info) => {
  await page.setViewportSize({ width, height: 850 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const requests: string[] = [], errors: string[] = [];
  page.on("request", r => requests.push(r.url()));
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("/");
  const section = page.getByRole("region", { name: "Watch how it works", exact: true });
  const video = page.getByLabel("LifePot explained product demo", { exact: true });
  await section.scrollIntoViewIfNeeded();
  await expect(video).toHaveAttribute("preload", "none");
  expect(await video.evaluate((v: HTMLVideoElement) => v.paused && v.currentTime === 0 && !v.autoplay && !v.loop && v.controls && v.playsInline)).toBe(true);
  expect(requests.some(url => /lifepot-explained-demo.*\.mp4/.test(url))).toBe(false);
  expect(requests.some(url => url.includes("/api/") || url.includes("example-world.json"))).toBe(false);
  const poster = await video.evaluate(async (v: HTMLVideoElement) => {
    const image = new Image(); image.src = v.poster; await image.decode();
    return { width: image.naturalWidth, height: image.naturalHeight };
  });
  expect(poster).toEqual({ width: 1920, height: 1080 });
  const box = await video.boundingBox(); expect(box).not.toBeNull();
  expect(box!.width).toBeLessThanOrEqual(width);
  expect(Math.abs(box!.width / box!.height - 16 / 9)).toBeLessThan(.02);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  // Native controls: real keyboard activation, not a stubbed play() promise.
  await video.press("Space");
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => !v.paused && v.currentTime > 0 && v.videoWidth === 1920)).toBe(true);
  expect(await video.evaluate((v: HTMLVideoElement) => v.duration)).toBeCloseTo(168, 1);
  await video.evaluate((v: HTMLVideoElement) => { v.pause(); v.currentTime = 70; });
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => !v.seeking && Math.abs(v.currentTime - 70) < .1)).toBe(true);
  await page.screenshot({ path: info.outputPath(`demo-${width}-playing.png`), fullPage: true });
  await section.getByText("Read the demo transcript", { exact: true }).click();
  await expect(section.getByText("Fecundity shifts the energy needed to reproduce.").first()).toBeVisible();
  await video.evaluate((v: HTMLVideoElement) => { v.textTracks[0].mode = "hidden"; });
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.textTracks[0].cues?.length)).toBe(17);
  const track = video.locator("track");
  const captions = await request.get((await track.getAttribute("src"))!);
  expect(captions.ok()).toBe(true);
  expect(await captions.text()).toContain("00:02:48.000");
  const range = await request.get((await video.locator("source").getAttribute("src"))!, { headers: { Range: "bytes=0-1023" } });
  expect(range.status()).toBe(206);
  expect(range.headers()["content-type"]).toContain("video/mp4");
  expect(range.headers()["content-range"]).toBe("bytes 0-1023/5202349");
  expect((await range.body()).length).toBe(1024);
  await expect(page.locator("[data-example-video]")).toBeAttached();
  await expect(page.getByRole("link", { name: /Create your own world/ })).toBeVisible();
  expect(errors).toEqual([]);
});
