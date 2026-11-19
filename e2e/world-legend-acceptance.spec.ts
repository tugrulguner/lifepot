import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type TestInfo } from "@playwright/test";
import { roleColor } from "../src/game/world-presentation";

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
          svg: row.querySelector("svg.species-legend-glyph")?.outerHTML,
        };
      }));
      expect(roles.length).toBeGreaterThan(1);
      for (const row of roles) {
        expect(row.role).toBeTruthy();
        expect(row.id).toMatch(/^[A-Z]$/);
        const expected = roleColor(row.role, row.id!);
        const expectedRgb = expected.match(/[0-9a-f]{2}/gi)!.map(channel => parseInt(channel, 16));
        const png = await legend.locator(`span[aria-label="Species ${row.id} count"] svg`).screenshot();
        const decoded = await page.evaluate(async ({ base64, expected }) => {
          const image = new Image(); image.src = `data:image/png;base64,${base64}`; await image.decode();
          const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
          const context = canvas.getContext("2d", { willReadFrequently: true })!; context.drawImage(image, 0, 0);
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
          let opaque = 0, matching = 0;
          for (let i = 0; i < pixels.length; i += 4) if (pixels[i + 3] > 200) {
            opaque++;
            if (Math.max(Math.abs(pixels[i]-expected[0]),Math.abs(pixels[i+1]-expected[1]),Math.abs(pixels[i+2]-expected[2])) <= 45) matching++;
          }
          return { opaque, matching };
        }, { base64: png.toString("base64"), expected: expectedRgb });
        expect(decoded.opaque, `${row.role} ${row.id} decoded glyph has meaningful pixels`).toBeGreaterThan(20);
        expect(decoded.matching, `${row.role} ${row.id} glyph pixels match approved role palette`).toBeGreaterThan(10);
        expect(row.text).toContain(row.role!);
        expect(row.text).toContain(row.id!);
      }
      expect(new Set(roles.map(row => roleColor(row.role, row.id!))).size).toBeGreaterThan(1);
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
