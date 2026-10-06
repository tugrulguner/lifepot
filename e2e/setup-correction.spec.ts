import { test, expect } from "@playwright/test";
import { defaultConfig } from "../src/game/setup";
const answers = ["A: algae producer. B eats A. C eats B, not A.", "Moderate drought", "Observe coexistence"];
async function setup(page: import("@playwright/test").Page) {
 await page.goto("/");
 for (const answer of answers) { await page.locator("input").fill(answer); await page.getByRole("button", { name: /Continue|Review ecosystem/ }).click(); }
}
test("unresolved corrected setup identifies one review focus and preserves original answers", async ({ page }) => {
 await page.route("**/api/judge", async route => { const input = route.request().postDataJSON(); await route.fulfill({ json: { config: defaultConfig(), source: "jev", requestHash: input.requestHash, model: "jev-test", fidelity: { verdict: "needs_clarification", repairAttempted: true, focus: "feeding_links", model: "jev-test", usage: { input_tokens: 10, output_tokens: 1 } } } }); });
 await setup(page);
 await expect(page.getByText("Who eats whom? Confirm each feeding direction using the species names.")).toBeVisible();
 await expect(page.getByRole("button", { name: /Seed ecosystem/ })).toBeDisabled();
 await page.getByRole("button", { name: "Edit setup answers" }).click();
 await expect(page.locator("input")).toHaveValue(answers[0]);
});
test("a corrected and approved proposal is reviewable and seedable without rewriting", async ({ page }) => {
 await page.route("**/api/judge", async route => { const input = route.request().postDataJSON(); await route.fulfill({ json: { config: defaultConfig(), source: "jev", requestHash: input.requestHash, model: "jev-test", fidelity: { verdict: "approve", repairAttempted: true, model: "jev-test", usage: { input_tokens: 10, output_tokens: 1 } } } }); });
 await setup(page);
 await expect(page.getByText(/Jev corrected its proposed food web/)).toBeVisible();
 await expect(page.getByRole("button", { name: /Seed ecosystem/ })).toBeEnabled();
});
