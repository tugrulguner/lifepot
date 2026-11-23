import { expect, test } from "@playwright/test";

for (const width of [320, 390, 1280]) {
  test(`homepage entry promises reach their destinations at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.goto("/");
    const actions = page.getByRole("navigation", { name: "Explore LifePot" });
    const create = actions.getByRole("link", { name: /Play LifePot/ });
    const observatory = page.getByRole("link", { name: "Open observatory", exact: true });
    await expect(create).toHaveAttribute("href", "/experiment");
    await expect(observatory).toHaveAttribute("href", "/play");
    await expect(create).toBeInViewport();
    await expect(actions.getByRole("link", {name: "Play example"})).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    await create.click();
    await expect(page).toHaveURL(/\/experiment$/);
    await expect(page.getByRole("textbox", { name: "What exists in your world?" })).toBeVisible();

    await page.goto("/");
    await page.getByRole("link", { name: "Open observatory", exact: true }).click();
    await expect(page).toHaveURL(/\/play$/);
    await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();

    await page.goto("/");
    await page.locator(".home-reference").locator("summary").click();
    await page.getByRole("link", { name: "All learning guides" }).click();
    await expect(page).toHaveURL(/\/learn$/);
    await expect(page.getByRole("heading", { name: "LifePot documentation" })).toBeVisible();
  });
}
