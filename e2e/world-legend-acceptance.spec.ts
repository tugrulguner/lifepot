import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type TestInfo } from "@playwright/test";
import { speciesColor } from "../src/game/species-colors";

const viewports = [
  { width: 1280, height: 850 }, { width: 1280, height: 633 },
  { width: 768, height: 850 }, { width: 390, height: 850 }, { width: 320, height: 850 },
];
function evidence(testInfo: TestInfo, name: string) {
  const dir = process.env.LIFEPOT_EVIDENCE_DIR ?? testInfo.outputDir;
  mkdirSync(dir, { recursive: true });
  return join(dir, name);
}

test.describe("built gameplay world legend acceptance", () => {
  for (const viewport of viewports) for (const theme of ["light", "dark"] as const) {
    test(`${viewport.width}x${viewport.height} ${theme}: live and paused inspected legend`, async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.setViewportSize(viewport);
      await page.emulateMedia({ colorScheme: theme });
      let judgeCalls = 0;
      await page.route("**/api/judge**", async route => { judgeCalls++; await route.abort(); });
      await page.goto("/play");
      await page.getByRole("combobox", { name: "Color theme" }).selectOption(theme);
      await page.getByRole("button", { name: "Explore deterministic preset" }).click();
      await page.getByRole("button", { name: /Seed ecosystem/ }).click();
      const board = page.locator("canvas.life-canvas");
      const generation = page.getByTestId("generation");
      await expect(generation).not.toHaveText("0 / 180", { timeout: 5_000 });
      const legend = page.getByLabel("Configured species counts");
      await expect(legend).toBeVisible();
      await expect(legend).toContainText("World legend");
      const roles = await legend.locator(":scope > span").evaluateAll(rows => rows.map(row => {
        const text = row.textContent ?? "";
        const role = text.match(/producer|grazer|scavenger|hunter|omnivore/)?.[0];
        const id = text.match(/· ([A-Z])/)?.[1];
        return {
          role, id, text,
          path: row.querySelector("svg > g > path:not([fill=none])")?.getAttribute("d"),
          fill: row.querySelector("svg > g > path:not([fill=none])")?.getAttribute("fill"),
        };
      }));
      expect(roles.length).toBeGreaterThan(1);
      for (const row of roles) {
        expect(row.role).toBeTruthy();
        expect(row.id).toMatch(/^[A-Z]$/);
        expect(row.path).toBeTruthy();
        expect(row.path).toContain("M");
        expect(row.fill).toBe(speciesColor(row.id!));
      }
      const watching = await page.evaluate(() => {
        const rect = (selector: string) => document.querySelector(selector)!.getBoundingClientRect().toJSON();
        const legendRect = document.querySelector(".configured-species-counts")!.getBoundingClientRect();
        const boardRect = rect("canvas.life-canvas");
        const headerRect = rect(".family-header");
        const controlsRect = rect(".controls");
        return { legend: legendRect.toJSON(), board: boardRect, header: headerRect, controls: controlsRect,
          scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, scrollY };
      });
      expect(watching.legend.y).toBeGreaterThanOrEqual(watching.header.bottom);
      expect(watching.legend.bottom).toBeLessThanOrEqual(viewport.height - 8);
      expect(watching.board.bottom).toBeLessThanOrEqual(viewport.height - 8);
      expect(watching.controls.bottom).toBeLessThanOrEqual(viewport.height - 8);
      expect(watching.scrollWidth).toBeLessThanOrEqual(watching.clientWidth);
      expect(watching.scrollY).toBe(0);
      const roleGlyph = legend.locator("svg.species-legend-glyph").first();
      const glyphBounds = await roleGlyph.boundingBox();
      expect(glyphBounds?.width).toBeGreaterThanOrEqual(14);
      expect(glyphBounds?.height).toBeGreaterThanOrEqual(14);
      const details = legend.locator("details");
      await expect(details).toHaveCount(0);
      await page.screenshot({ path: evidence(testInfo, `legend-watching-${viewport.width}x${viewport.height}-${theme}.png`) });

      await page.getByRole("button", { name: "Pause", exact: true }).click();
      await page.getByRole("button", { name: "Inspect living organism", exact: true }).click();
      await expect(page.getByRole("region", { name: "Creature inspector" })).toBeVisible();
      await expect(legend).toBeVisible();
      await expect(legend).toContainText("World legend");
      await page.screenshot({ path: evidence(testInfo, `legend-paused-inspecting-${viewport.width}x${viewport.height}-${theme}.png`) });
      const stateAfterActions = await generation.textContent();
      await expect(page.getByRole("button", { name: "Resume", exact: true })).toBeVisible();
      await expect(generation).toHaveText(stateAfterActions ?? "");
      expect(judgeCalls).toBe(0);
      expect(errors).toEqual([]);
      await board.evaluate((canvas: HTMLCanvasElement) => {
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas unavailable");
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        if (!data.some((value, i) => i % 4 !== 3 && value > 40)) throw new Error("Canvas frame has no colored pixels");
      });
    });
  }
});
