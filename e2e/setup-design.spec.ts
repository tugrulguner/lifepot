import { test, expect } from "@playwright/test";

for (const width of [1280, 768, 390, 320]) {
  test(`setup is centered and usable at ${width}px in both themes`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.goto("/experiment");
    await page.getByRole("button", { name: "Describe your own world", exact: true }).click();
    for (const theme of ["Light", "Dark"]) {
      await page.getByRole("combobox", { name: "Theme" }).selectOption({ label: theme });
      const panel = page.locator(".question-panel");
      await page.getByRole("textbox").fill("W".repeat(140));
      await expect(panel.locator(".answer-field span")).toHaveText("140/140");
      const geometry = await panel.evaluate(el => {
        const r = el.getBoundingClientRect();
        const field = el.querySelector("textarea")!;
        const input = field.getBoundingClientRect();
        const counter = el.querySelector(".answer-field span")!.getBoundingClientRect();
        const header = document.querySelector(".family-header")!.getBoundingClientRect();
        return { counterTop:counter.top, fieldBottom:input.bottom, fits:field.scrollHeight <= field.clientHeight && field.scrollWidth <= field.clientWidth, center: r.x + r.width / 2, viewport: document.documentElement.clientWidth / 2,
          inputCenter: input.x + input.width / 2, inputTop: input.top, headerBottom: header.bottom,
          overflow: document.documentElement.scrollWidth > window.innerWidth };
      });
      expect(Math.abs(geometry.center - geometry.viewport)).toBeLessThan(2);
      expect(Math.abs(geometry.inputCenter - geometry.center)).toBeLessThan(2);
      expect(geometry.inputTop).toBeGreaterThan(geometry.headerBottom);
      expect(geometry.overflow).toBe(false);
      expect(geometry.fits).toBe(true);
      expect(geometry.counterTop).toBeGreaterThanOrEqual(geometry.fieldBottom);
      await page.screenshot({path:test.info().outputPath(`field-${width}-${theme}.png`)});
      await expect(panel.locator("details")).not.toHaveAttribute("open", "");
      await page.getByRole("textbox").fill("A pond with algae and grazers");
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await expect(page.locator(".step-label")).toContainText("QUESTION 2");
      await page.getByRole("button", { name: "Back", exact: true }).click();
      await expect(page.getByRole("textbox")).toHaveValue("A pond with algae and grazers");
      await panel.locator("summary").click();
      await expect(page.getByRole("link", { name: "Created by Tugrul Guner" })).toBeVisible();
      await panel.locator("summary").click();
    }
  });
}
