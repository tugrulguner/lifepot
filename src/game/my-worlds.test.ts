// @vitest-environment jsdom
import { IDBFactory, IDBObjectStore } from "fake-indexeddb";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createReplay, playReplay, type ReplayData } from "./replay";
import { defaultConfig, hashSetupRequest } from "./setup";
import { deleteWorld, exportWorld, importWorld, listWorlds, saveWorld } from "./my-worlds";
import { createRunEvidence, observeRun, type RunEvidence } from "./run-evidence";
import { createSimulation, stepSimulation } from "./world";
import { runFreshWithDecisions, activeDecisionForGeneration } from "./runtime";
import { deterministicEvolutionDecision } from "./decisions";
const answers = { world: "rich plains", threat: "drought", reward: "coexist" };
let replay: ReplayData, evidence: RunEvidence;
beforeEach(async () => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  if (!replay) {
    const config = defaultConfig(), seed = 8;
    const fresh = await runFreshWithDecisions(createSimulation({ seed, config }), answers, async summary => deterministicEvolutionDecision(summary));
    replay = createReplay({ answers, config, seed, requestHash: hashSetupRequest(answers), ledger: fresh.ledger });
    let state = createSimulation({ seed, config }); evidence = createRunEvidence(state);
    while (state.outcome === "running") { state = stepSimulation(state, activeDecisionForGeneration(replay.ledger, state.generation), replay.ledger); evidence = observeRun(evidence, state); }
  }
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function save(name = "My valley", parentId: string | null = null) {
  const { state } = await playReplay(replay);
  return saveWorld({ replay, evidence, outcome: state.outcome as "surviving" | "thriving" | "extinct", stopReason: state.stats.population === 0 ? "World empty" : "Observation horizon reached", parentId, policy: "fixed" }, name);
}
it("commits, lists, deletes and restores portable identity/parent links without private notes", async () => {
  const parent = await save(), child = await save("Follow-up", parent.id);
  const backup = exportWorld(parent), childBackup = exportWorld(child);
  expect(backup).not.toContain("privateQuestion");
  await deleteWorld(child.id); await deleteWorld(parent.id);
  const imported = await importWorld(backup), importedChild = await importWorld(childBackup);
  expect(imported.id).toBe(parent.id); expect(importedChild.parentId).toBe(imported.id);
  expect(imported.replay).toEqual(parent.replay);
  expect(await listWorlds()).toHaveLength(2);
}, 30_000);
it("supports optional names and does not overwrite an existing save on duplicate import", async () => {
  const original = await save("  ");
  expect(original.name).toBe("Unnamed world");
  await expect(importWorld(exportWorld(original))).rejects.toThrow(/already|duplicate/i);
  expect(await listWorlds()).toHaveLength(1);
}, 30_000);
it("rejects tampered samples, milestones, stop reason, unknown/private fields and oversized imports without writing", async () => {
  const original = await save(); const portable = JSON.parse(exportWorld(original)); await deleteWorld(original.id);
  for (const tampered of [
    { ...portable, evidence: { ...portable.evidence, samples: portable.evidence.samples.map((sample: object, i: number) => i === 0 ? { ...sample, population: 2500 } : sample) } },
    { ...portable, evidence: { ...portable.evidence, firstExtinction: [{ speciesId: "A", generation: 1 }] } },
    { ...portable, stopReason: "Won the best ecosystem award" },
    { ...portable, privateQuestion: "PRIVATE" },
    { ...portable, version: 99 },
  ]) await expect(importWorld(JSON.stringify(tampered))).rejects.toThrow(/invalid|unsupported/i);
  await expect(importWorld(" ".repeat(512_001))).rejects.toThrow(/512 KB/i);
  expect(await listWorlds()).toHaveLength(0);
}, 30_000);
it("rejects an aborted write after request success rather than reporting a committed save", async () => {
  const put = IDBObjectStore.prototype.add;
  vi.spyOn(IDBObjectStore.prototype, "add").mockImplementation(function (this: IDBObjectStore, ...args: Parameters<typeof put>) {
    const request = put.apply(this, args); request.addEventListener("success", () => this.transaction.abort()); return request;
  });
  await expect(save()).rejects.toThrow(/storage|abort|unavailable/i);
  expect(await listWorlds()).toHaveLength(0);
}, 30_000);
it("surfaces quota failures without persisting or discarding existing records", async () => {
  const original = await save();
  vi.spyOn(IDBObjectStore.prototype, "add").mockImplementation(() => { throw new DOMException("Quota exceeded", "QuotaExceededError"); });
  await expect(save("Another")).rejects.toThrow(/quota|full/i);
  expect((await listWorlds())[0].id).toBe(original.id);
}, 30_000);
it("reports unavailable storage without crashing the rest of gameplay", async () => {
  vi.stubGlobal("indexedDB", undefined);
  await expect(listWorlds()).rejects.toThrow(/storage|unavailable/i);
});
