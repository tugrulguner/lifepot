import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { test, expect } from "@playwright/test";
import { deterministicEvolutionDecision } from "../src/game/decisions";

test("completed runs expose reachable continuation actions before evidence and retain review authority", async ({ page }, info) => {
  test.setTimeout(300_000);
  const requests: unknown[] = [];
  const errors: string[] = [];
  const evidenceDir = process.env.LIFEPOT_EVIDENCE_DIR;
  if (evidenceDir) mkdirSync(evidenceDir, { recursive: true });
  const evidencePath = (name: string) => evidenceDir ? join(evidenceDir, name) : info.outputPath(name);
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/api/judge", async route => {
    const payload = route.request().postDataJSON();
    requests.push(payload);
    if (payload.kind === "evolution") await route.fulfill({ json: deterministicEvolutionDecision(payload.summary) });
    else await route.abort();
  });

  await page.setViewportSize({ width: 390, height: 850 });
  await page.goto("/play");
  await page.getByRole("button", { name: "Explore deterministic preset" }).click();
  await page.getByRole("button", { name: /Seed ecosystem/ }).click();
  await page.getByRole("combobox", { name: "Playback speed" }).selectOption("fast");
  const results = page.getByRole("region", { name: "Run results", exact: true });
  await expect(results).toContainText("Reached the 180-generation observation limit", { timeout: 180_000 });
  await expect(results).toContainText("toy model, not biological proof");
  await expect(results).toContainText("Peak population:");
  await expect(page.getByRole("region", { name: "Jev run reflection" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Share final world image" })).toBeVisible();
  await expect(page.getByRole("region", { name: "My Worlds — browser-local saves" })).toBeVisible();
  await expect(page.getByText(/Optional private questions and notes are omitted/)).toBeVisible();
  for (const viewport of [{ width: 375, height: 850 }, { width: 390, height: 850 }, { width: 1280, height: 850 }]) {
    await page.setViewportSize(viewport);
    const actions = page.getByRole("navigation", { name: "Run actions" });
    await actions.scrollIntoViewIfNeeded();
    const metrics = page.getByRole("list", { name: "Observed outcomes" });
    const geometry = await page.evaluate(() => {
      const section = document.querySelector<HTMLElement>("#run-results")!;
      const nav = section.querySelector<HTMLElement>('nav[aria-label="Run actions"]')!;
      const outcomes = section.querySelector<HTMLElement>('ul[aria-label="Observed outcomes"]')!;
      const sectionTop = section.getBoundingClientRect().top;
      const navRect = nav.getBoundingClientRect();
      return { actionOffset: navRect.top - sectionTop, actionBottom: navRect.bottom - sectionTop, outcomesOffset: outcomes.getBoundingClientRect().top - sectionTop, width: innerWidth, clientWidth: document.documentElement.clientWidth };
    });
    expect(geometry.actionOffset).toBeLessThan(400);
    expect(geometry.actionBottom).toBeLessThan(520);
    expect(geometry.actionOffset).toBeLessThan(geometry.outcomesOffset);
    expect(geometry.clientWidth).toBeLessThanOrEqual(geometry.width);
    for (const name of ["Inspect final world", "Replay this run", "Edit this world", "New world"]) {
      const button = page.getByRole("button", { name, exact: true });
      await expect(button).toBeVisible();
      const hit = await button.evaluate(element => {
        const rect = element.getBoundingClientRect();
        const target = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return target === element || element.contains(target);
      });
      expect(hit, `${name} center should be hit-testable at ${viewport.width}px`).toBe(true);
    }
    await expect(metrics).toContainText("Peak population:");
    await expect(page.getByRole("img", { name: "Whole-run species population history" })).toBeVisible();
    await page.screenshot({ path: evidencePath(`continuation-${viewport.width}x${viewport.height}.png`) });
  }

  expect(requests.length).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Edit this world", exact: true }).click();
  await expect(page.getByRole("heading", { name: "World conditions" })).toBeVisible();
  await expect(page.getByText(/Your previous run is kept as the baseline/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Seed ecosystem/ })).toBeEnabled();
  await expect(page.getByRole("region", { name: "Run status", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: /Seed ecosystem/ }).click();
  await page.getByRole("combobox", { name: "Playback speed" }).selectOption("fast");
  await expect(results).toBeVisible({ timeout: 180_000 });
  const comparison = page.getByRole("region", { name: "Previous trial comparison" });
  await expect(comparison).toContainText(/Same initial seed: \d+\./);
  await expect(comparison).toContainText("No recorded condition changes.");
  await expect(comparison).toContainText("Compared with your previous trial");
  expect(errors).toEqual([]);
});
