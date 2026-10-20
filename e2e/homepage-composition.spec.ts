import { expect, test } from "@playwright/test";

for (const width of [320, 375, 390, 768, 800, 801, 1024, 1280, 1920, 2560]) {
  for (const theme of ["light", "dark", "auto"]) test(`homepage composition at ${width}px in ${theme}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 850 });
    await page.emulateMedia({ colorScheme: theme === "dark" ? "light" : "dark", reducedMotion: "reduce" });
    const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
    await page.goto("/");
    // Explicit selection is required for each matrix case; Auto alone is not coverage.
    await page.getByRole("combobox", { name: "Color theme" }).selectOption(theme);
    const artwork = page.locator(".overview-hero .overview-lockup");
    await expect.poll(() => artwork.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth === 1200)).toBe(true);
    await artwork.evaluate((i: HTMLImageElement) => i.decode());
    await page.evaluate(async () => { await document.fonts.ready; await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); });
    const metrics = await page.evaluate(() => {
      const element = (s: string) => { const e = document.querySelector(s); if (!(e instanceof HTMLElement)) throw new Error(`Missing ${s}`); return e; };
      const rect = (s: string) => element(s).getBoundingClientRect().toJSON();
      const style = (s: string) => getComputedStyle(element(s));
      const a = element(".overview-actions .overview-primary"), b = element(".overview-actions .overview-secondary");
      const hit = (e: HTMLElement) => { const r = e.getBoundingClientRect(); return e.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); };
      return {
        logo: rect(".overview-lockup"), hero: rect(".overview-hero"), example: rect(".example-card"), video: rect("video"),
        primary: rect(".overview-actions .overview-primary"), secondary: rect(".overview-actions .overview-secondary"),
        credit: rect(".overview-credit"), creatorRow: rect(".overview-hero .creator-row"), socials: [...document.querySelectorAll<HTMLElement>(".overview-hero .creator-social-links a")].map(e => ({ label:e.textContent, font:getComputedStyle(e).fontSize, height:e.getBoundingClientRect().height })), exampleAction: rect(".example-action"), hit: hit(a) && hit(b),
        creditHits: [...document.querySelectorAll<HTMLElement>(".overview-credit a")].map(hit),
        primaryBackground: style(".overview-actions .overview-primary").backgroundColor,
        secondaryBackground: style(".overview-actions .overview-secondary").backgroundColor,
        exampleBackground: style(".example-card").backgroundColor, shellBackground: style(".overview-shell").backgroundColor,
        headingSize: parseFloat(style(".overview-copy h1").fontSize), overflow: document.documentElement.scrollWidth > innerWidth,
        theme: document.documentElement.dataset.theme,
      };
    });
    expect(metrics.overflow).toBe(false);
    expect(metrics.headingSize).toBeLessThanOrEqual(56);
    expect(metrics.primaryBackground).not.toBe(metrics.secondaryBackground);
    expect(metrics.exampleBackground).not.toBe(metrics.shellBackground);
    expect(metrics.hit).toBe(true); expect(metrics.creditHits).toEqual([true, true]);
    expect(metrics.socials.map(s=>s.label)).toEqual(["GitHub", "LinkedIn", "X"]);
    for (const social of metrics.socials) { expect(social.font).toBe("15px"); expect(social.height).toBeGreaterThanOrEqual(44); }
    if (width <= 370) expect(metrics.creatorRow.height).toBeLessThanOrEqual(88);
    for (const r of [metrics.primary, metrics.secondary, metrics.credit, metrics.logo, metrics.video, metrics.exampleAction]) {
      expect(r.y).toBeGreaterThanOrEqual(64); expect(r.bottom).toBeLessThanOrEqual(850);
    }
    expect(metrics.primary.height).toBeGreaterThanOrEqual(44); expect(metrics.secondary.height).toBeGreaterThanOrEqual(44);
    if (width <= 370) {
      expect(metrics.primary.x).toBe(metrics.secondary.x); expect(metrics.primary.width).toBe(metrics.secondary.width);
      expect(metrics.secondary.y).toBeGreaterThanOrEqual(metrics.primary.bottom);
    } else expect(metrics.primary.y).toBe(metrics.secondary.y);
    expect(metrics.credit.y).toBeGreaterThanOrEqual(Math.max(metrics.primary.bottom, metrics.secondary.bottom));
    expect(metrics.example.y).toBeGreaterThanOrEqual(metrics.hero.bottom);
    if (width === 1280) expect(Math.abs(metrics.logo.width - 469.594)).toBeLessThan(2); // Live Intpot/Summonpot/Dexpot/RefPot reference.
    if (width <= 800) expect(metrics.logo.height).toBe(224); // Same contained mobile artwork treatment as the reference.
    await expect(page.locator('.overview-credit a[href="https://tugrul.modepot.io/"]')).toContainText("Created by Tugrul Guner");
    await expect(page.locator('.overview-credit a[href="https://modepot.io/"]')).toContainText("Part of ModePot");
    await expect(page.locator(".overview-example .overview-primary")).toHaveCount(0);
    await expect(page.locator(".overview-actions a")).toHaveCount(2);
    await page.screenshot({ path: info.outputPath(`homepage-${width}-${theme}.png`), fullPage: true });
    await info.attach("composition", { body: JSON.stringify(metrics, null, 2), contentType: "application/json" });
    if (theme === "auto") {
      await page.emulateMedia({ colorScheme: "light" });
      await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    }
    if (width <= 1100) {
      await expect(page.locator(".family-compact-home")).toBeVisible();
      await page.getByRole("button", { name: "Menu", exact: true }).click();
      await expect(page.locator('.family-menu-resources a[href="https://tugrul.modepot.io/"]')).toBeVisible();
      await page.keyboard.press("Escape");
    } else {
      await expect(page.locator('.family-desktop-resources a[href="https://modepot.io/"]')).toBeVisible();
      await expect(page.locator('.family-desktop-resources a[href="https://tugrul.modepot.io/"]')).toBeVisible();
    }
    expect(errors).toEqual([]);
  });
}
