import { expect, test } from "@playwright/test";

for (const width of [320, 390, 1280]) for (const theme of ["light", "dark"]) {
  test(`walkthrough presentation and chapter controls: ${width}px ${theme}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const mediaRequests: string[] = [], errors: string[] = [];
    page.on("request", r => { if (r.url().includes(".mp4") || r.url().includes("/api/")) mediaRequests.push(r.url()); });
    page.on("pageerror", e => errors.push(e.message));
    await page.goto("/");
    await page.getByRole("combobox", { name: "Color theme", exact: true }).selectOption(theme);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    const section = page.getByRole("region", { name: "Watch how it works", exact: true });
    const video = page.getByLabel("LifePot explained product demo", { exact: true });
    await section.scrollIntoViewIfNeeded();
    await expect(section.getByRole("button", { name: "Watch the walkthrough", exact: true })).toBeVisible();
    await expect(section.getByRole("navigation", { name: "Walkthrough chapters" }).getByRole("button")).toHaveCount(4);
    expect(mediaRequests).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const target of await section.locator("button, .demo-player-heading a, summary").all()) {
      const box = await target.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.width).toBeGreaterThanOrEqual(44);
    }
    await video.evaluate(async (v: HTMLVideoElement) => { const image = new Image(); image.src = v.poster; await image.decode(); });
    await section.screenshot({ path: info.outputPath(`walkthrough-${width}-${theme}.png`) });
    const start = section.getByRole("button", { name: "Watch the walkthrough", exact: true });
    await start.focus();
    const focus = await start.evaluate(e => { const s = getComputedStyle(e); return { style: s.outlineStyle, color: s.outlineColor, background: s.backgroundColor }; });
    expect(focus.style).toBe("solid");
    expect(focus.color).not.toBe(focus.background);

    // Exercise both initial-load paths with real native playback, not stubs.
    if (theme === "light") await section.getByRole("button", { name: "Watch the walkthrough", exact: true }).click();
    else await section.getByRole("button", { name: "Observe and inspect, 0:38", exact: true }).click();
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => !v.paused && v.currentTime > 0 && v.videoWidth === 1920)).toBe(true);
    if (theme === "dark") await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime >= 38 && v.currentTime < 48)).toBe(true);
    await expect(section.getByRole("button", { name: "Watch the walkthrough", exact: true })).toHaveCount(0);
    await section.getByRole("button", { name: "Compare and replay, 2:16", exact: true }).click();
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => !v.paused && !v.seeking && v.currentTime >= 136 && v.currentTime < 146)).toBe(true);
    await video.evaluate((v: HTMLVideoElement) => v.pause());
    await expect(section.getByRole("button", { name: "Compare and replay, 2:16", exact: true })).toHaveAttribute("aria-current", "step");
    await section.screenshot({ path: info.outputPath(`walkthrough-${width}-${theme}-chapter.png`) });
    await section.getByText("Read the demo transcript", { exact: true }).click();
    await expect(section.locator("details > ol > li")).toHaveCount(17);
    await expect(section.getByText("Fecundity shifts the energy needed to reproduce.").first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(mediaRequests.some(url => url.includes("/api/"))).toBe(false);
    expect(errors).toEqual([]);
  });
}
