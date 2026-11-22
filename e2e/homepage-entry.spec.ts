import { expect, test } from "@playwright/test";

for (const width of [320, 390, 1280]) {
  test(`homepage entry promises reach their destinations at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.goto("/");
    const actions = page.getByRole("navigation", { name: "Explore LifePot" });
    const create = page.getByRole("link", { name: "Create your own world" });
    const observatory = actions.getByRole("link", { name: "Open observatory" });
    const docs = actions.getByRole("link", { name: "Documentation" });
    await expect(create).toHaveAttribute("href", "/experiment");
    await expect(observatory).toHaveAttribute("href", "/play");
    await expect(docs).toHaveAttribute("href", "/learn");
    for (const link of [observatory, docs]) await expect(link).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    await create.click();
    await expect(page).toHaveURL(/\/experiment$/);
    await expect(page.getByRole("button", { name: "Describe your own world" })).toBeVisible();

    await page.goto("/");
    await actions.getByRole("link", { name: "Open observatory" }).click();
    await expect(page).toHaveURL(/\/play$/);
    await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();

    await page.goto("/");
    await actions.getByRole("link", { name: "Documentation" }).click();
    await expect(page).toHaveURL(/\/learn$/);
    await expect(page.getByRole("heading", { name: "LifePot documentation" })).toBeVisible();
  });
}
