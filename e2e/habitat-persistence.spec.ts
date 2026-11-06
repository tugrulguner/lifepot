import { test, expect, type Page } from "@playwright/test";
import { deepStrictEqual } from "node:assert";
import { readFile } from "node:fs/promises";
import { createHabitatCheckpoint, decodeHabitatCheckpoint, encodeHabitatCheckpoint, type HabitatCheckpoint } from "../src/game/habitat-checkpoint";
import { advanceFixedHabitat, createFixedHabitat, extendFixedHabitat } from "../src/game/fixed-habitat";
import { createRunEvidence, observeRun } from "../src/game/run-evidence";
import { defaultConfig } from "../src/game/setup";

const library = (page: Page) => page.getByRole("region", { name: "Saved habitats — fixed-habitat checkpoints" });
async function records(page: Page): Promise<Array<{ id: string; wire: string }>> {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open("lifepot-fixed-habitats", 1);
    request.onerror = () => reject(new Error("Cannot read test checkpoint"));
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction("habitats", "readonly");
      const rows = transaction.objectStore("habitats").getAll();
      transaction.oncomplete = () => { db.close(); resolve(rows.result); };
      transaction.onabort = () => { db.close(); reject(new Error("Test checkpoint read aborted")); };
    };
  }));
}
async function save(page: Page, priorSavedAt?: number): Promise<HabitatCheckpoint> {
  await page.getByRole("button", { name: "Pause and save habitat", exact: true }).click();
  await expect.poll(async () => {
    const rows = await records(page);
    return rows.length === 1 && decodeHabitatCheckpoint(rows[0].wire).savedAt !== priorSavedAt;
  }).toBe(true);
  await expect(page.getByRole("region", { name: "Habitat continuity" }).getByRole("status")).toContainText("Habitat saved at generation");
  return decodeHabitatCheckpoint((await records(page))[0].wire);
}
async function importCheckpoint(page: Page, checkpoint: HabitatCheckpoint) {
  await library(page).getByLabel("Import a habitat backup", { exact: true }).setInputFiles({ name: "habitat.json", mimeType: "application/json", buffer: Buffer.from(encodeHabitatCheckpoint(checkpoint)) });
  await expect(library(page).getByRole("status")).toContainText("imported on this device");
}
function fixture(limit: number, empty = false): HabitatCheckpoint {
  let state = createFixedHabitat({ seed: 41, config: defaultConfig(), observationLimit: limit, ...(empty ? { initialPopulation: [] } : {}) });
  let evidence = createRunEvidence(state);
  if (!empty && limit === 3) state = advanceFixedHabitat(state, limit, next => { evidence = observeRun(evidence, next); });
  return createHabitatCheckpoint({ id: "61c539c3-ef4d-4425-a567-803a89d3e099", name: "Boundary pond", createdAt: 100, savedAt: 200, parentId: null, state, evidence });
}
for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
  test(`same habitat survives reload, continuation and portable backup at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.clock.install({ time: new Date("2026-01-01T11:59:59Z") });
    await page.clock.pauseAt(new Date("2026-01-01T12:00:00Z"));
    const errors: string[] = [], inference: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/api/{judge,reflect,player-proposal}", route => { inference.push(route.request().url()); return route.abort(); });
    await page.goto("/play");
    await page.getByRole("button", { name: "Explore deterministic preset", exact: true }).click();
    await page.getByLabel("World policy", { exact: true }).selectOption("fixed");
    await expect(page.getByRole("checkbox", { name: "Enable same-world save and continuation" })).not.toBeChecked();
    await page.getByRole("checkbox", { name: "Enable same-world save and continuation" }).check();
    await page.getByRole("button", { name: /Seed ecosystem/ }).click();
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await expect(page.getByTestId("generation")).toHaveText(/^0 \/ /);
    await page.getByRole("button", { name: "Inspect a living organism", exact: true }).click();
    await page.getByRole("region", { name: "Creature inspector" }).getByRole("button", { name: /Follow founder lineage/ }).click();
    await page.getByLabel("Habitat name", { exact: true }).fill("Returning pond");
    const first = await save(page);
    expect(first.evidence.followedFamily).not.toBeNull();
    expect(first.state.generation).toBe(0);
    const beforeReload = (await records(page))[0].wire;
    await page.reload();
    await library(page).getByRole("button", { name: "Open paused habitat: Returning pond", exact: true }).click();
    await expect(page.getByRole("button", { name: "Resume", exact: true })).toBeVisible();
    await page.clock.runFor(2000);
    await expect(page.getByTestId("generation")).toHaveText(/^0 \/ /);
    expect((await records(page))[0].wire).toBe(beforeReload);
    const restored = await save(page, first.savedAt);
    deepStrictEqual(restored.state, first.state);
    deepStrictEqual(restored.evidence, first.evidence);
    expect(restored.id).toBe(first.id);
    expect(restored.createdAt).toBe(first.createdAt);
    await page.getByRole("button", { name: "Step one generation", exact: true }).click();
    const advanced = await save(page, restored.savedAt);
    const expected = advanceFixedHabitat(first.state, 1);
    deepStrictEqual(advanced.state, expected);
    deepStrictEqual(advanced.evidence, observeRun(first.evidence, expected));
    expect(advanced.id).toBe(first.id);
    expect(await records(page)).toHaveLength(1);
    const downloading = page.waitForEvent("download");
    await library(page).getByRole("button", { name: "Export habitat: Returning pond", exact: true }).click();
    const download = await downloading;
    const backup = await readFile((await download.path())!, "utf8");
    deepStrictEqual(decodeHabitatCheckpoint(backup), advanced);
    page.once("dialog", dialog => dialog.accept());
    await library(page).getByRole("button", { name: "Delete habitat: Returning pond", exact: true }).click();
    await expect.poll(async () => (await records(page)).length).toBe(0);
    await library(page).getByLabel("Import a habitat backup", { exact: true }).setInputFiles({ name: "habitat.json", mimeType: "application/json", buffer: Buffer.from(backup) });
    await expect(library(page).getByRole("status")).toContainText("imported on this device");
    await library(page).getByRole("button", { name: "Open paused habitat: Returning pond", exact: true }).click();
    const returned = await save(page, advanced.savedAt);
    deepStrictEqual(returned.state, advanced.state);
    deepStrictEqual(returned.evidence, advanced.evidence);
    await page.getByRole("button", { name: "Resume", exact: true }).click();
    await page.clock.runFor(1200);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    const resumed = await save(page, returned.savedAt);
    expect(resumed.state.generation).toBeGreaterThan(returned.state.generation);
    deepStrictEqual(resumed.state, advanceFixedHabitat(returned.state, resumed.state.generation - returned.state.generation));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator("canvas.life-canvas").scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`returning-habitat-${viewport.width}.png`), fullPage: true });
    expect(errors).toEqual([]);
    expect(inference).toEqual([]);
  });
}

test("completed window extends explicitly without replacing or advancing its world", async ({ page }) => {
  const checkpoint = fixture(3);
  expect(checkpoint.state.generation).toBe(3);
  await page.goto("/play");
  await importCheckpoint(page, checkpoint);
  await library(page).getByRole("button", { name: "Open paused habitat: Boundary pond", exact: true }).click();
  await expect(page.getByText("Reached the 3-generation observation limit", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Replay this run", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Edit this world", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: /^Extend observation/ }).click();
  await expect(page.getByRole("button", { name: "Resume", exact: true })).toBeVisible();
  const extended = await save(page, checkpoint.savedAt);
  deepStrictEqual(extended.state, extendFixedHabitat(checkpoint.state, 183));
  deepStrictEqual(extended.evidence, checkpoint.evidence);
  expect(extended.id).toBe(checkpoint.id);
  await expect(page.getByRole("group", { name: "Watching progress" })).toContainText("3 / 183");
});

test("failed save and duplicate import preserve the prior checkpoint and paused world", async ({ page }) => {
  const checkpoint = fixture(1800);
  await page.goto("/play");
  await importCheckpoint(page, checkpoint);
  await library(page).getByRole("button", { name: "Open paused habitat: Boundary pond", exact: true }).click();
  const prior = (await records(page))[0].wire;
  // Inject a named browser storage fault at the real write boundary.
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.transaction.db.name === "lifepot-fixed-habitats") throw new DOMException("Injected quota failure", "QuotaExceededError");
      return original.apply(this, args);
    };
  });
  await page.getByRole("button", { name: "Step one generation", exact: true }).click();
  await page.getByRole("button", { name: "Pause and save habitat", exact: true }).click();
  await expect(page.getByRole("region", { name: "Habitat continuity" }).getByRole("alert")).toContainText("quota");
  await expect(page.getByRole("button", { name: "Resume", exact: true })).toBeVisible();
  await expect(page.getByTestId("generation")).toHaveText("1 / 1800");
  expect((await records(page))[0].wire).toBe(prior);
  await library(page).getByLabel("Import a habitat backup", { exact: true }).setInputFiles({ name: "duplicate.json", mimeType: "application/json", buffer: Buffer.from(prior) });
  await expect(library(page).getByRole("alert")).toContainText("already exists");
  expect((await records(page))[0].wire).toBe(prior);
  await expect(page.getByTestId("generation")).toHaveText("1 / 1800");
  await library(page).getByLabel("Import a habitat backup", { exact: true }).setInputFiles({ name: "corrupt.json", mimeType: "application/json", buffer: Buffer.from("{}") });
  await expect(library(page).getByRole("alert")).not.toContainText("already exists");
  await expect(page.getByTestId("generation")).toHaveText("1 / 1800");
  expect((await records(page))[0].wire).toBe(prior);
  await page.reload();
  await library(page).getByRole("button", { name: "Open paused habitat: Boundary pond", exact: true }).click();
  await expect(page.getByTestId("generation")).toHaveText(/^0 \/ /);
  deepStrictEqual((await save(page, checkpoint.savedAt)).state, checkpoint.state);
});

for (const kind of ["extinct", "cap"] as const) test(`${kind} habitat cannot be extended or reseeded by reopening`, async ({ page }) => {
  const checkpoint = fixture(kind === "cap" ? 1800 : 180, kind === "extinct");
  await page.goto("/play");
  await importCheckpoint(page, checkpoint);
  await library(page).getByRole("button", { name: "Open paused habitat: Boundary pond", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Extend observation/ })).toHaveCount(0);
  const saved = await save(page, checkpoint.savedAt);
  deepStrictEqual(saved.state, checkpoint.state);
  deepStrictEqual(saved.evidence, checkpoint.evidence);
});
