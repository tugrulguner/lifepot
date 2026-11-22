import { expect, test } from "@playwright/test";

for (const width of [320, 390, 1280]) {
  test(`input-first setup is visible and editable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.goto("/");
    await page.getByRole("link", { name: /Play LifePot/ }).click();
    const question = page.getByRole("heading", { name: "What exists in your world?" });
    const answer = page.getByRole("textbox", { name: "What exists in your world?" });
    const continueButton = page.getByRole("button", { name: "Continue", exact: true });
    const starterSwitch = page.getByRole("button", { name: "Use a starter world instead" });
    await expect(question).toBeVisible();
    await expect(answer).toBeVisible();
    await expect(continueButton).toBeVisible();
    await expect(starterSwitch).toBeVisible();
    for (const control of [question, answer, continueButton, starterSwitch]) await expect(control).toBeInViewport();
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
    expect(await page.evaluate(() => scrollY)).toBe(0);
    await page.screenshot({ path: `test-results/input-first-${width}.png`, fullPage: false });

    await answer.fill("A draft world of clear pools");
    await continueButton.click();
    await expect(page.getByRole("heading", { name: "What threatens life here?" })).toBeVisible();

    await page.getByRole("button", { name: "Use a starter world instead" }).click();
    await expect(page.getByRole("heading", { name: "Choose a living world" })).toBeVisible();
    await page.getByRole("button", { name: "Describe your own world" }).click();
    await expect(page.getByRole("heading", { name: "What threatens life here?" })).toBeVisible();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "What exists in your world?" })).toHaveValue("A draft world of clear pools");
  });
}
