import { deepStrictEqual } from "node:assert";
import { IDBFactory, IDBObjectStore } from "fake-indexeddb";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { advanceFixedHabitat, createFixedHabitat } from "./fixed-habitat";
import { createRunEvidence, followRunLineage, observeRun } from "./run-evidence";
import { defaultConfig } from "./setup";
import { createHabitatCheckpoint, decodeHabitatCheckpoint, encodeHabitatCheckpoint, type HabitatCheckpoint } from "./habitat-checkpoint";
import { deleteHabitat, importHabitat, listHabitats, loadHabitat, saveHabitat } from "./habitat-storage";
import { GRID_CELLS } from "./world";

const id1 = "61c539c3-ef4d-4425-a567-803a89d3e099";
const id2 = "71c539c3-ef4d-4425-a567-803a89d3e099";
beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function pausedWorld() {
  let state = createFixedHabitat({ seed: 241, config: defaultConfig() });
  let evidence = createRunEvidence(state);
  const cell = state.guild.findIndex(value => value !== 0);
  evidence = followRunLineage(evidence, state, state.lineage[cell]);
  state = advanceFixedHabitat(state, 3, next => { evidence = observeRun(evidence, next); });
  return { state, evidence };
}

function checkpoint(id = id1, name = "Pond family", savedAt = 200): HabitatCheckpoint {
  return createHabitatCheckpoint({ id, name, createdAt: 100, savedAt, parentId: null, ...pausedWorld() });
}

it("reads exact checkpoint state, evidence, setup and identity, then continues deterministically", async () => {
  const input = checkpoint();
  const saved = await saveHabitat(input, null);
  const loaded = await loadHabitat(input.id);
  deepStrictEqual(saved, input);
  deepStrictEqual(loaded, input);
  expect(loaded.state.energy).toBeInstanceOf(Float32Array);
  expect(loaded.state.organismId).toBeInstanceOf(Uint32Array);
  deepStrictEqual(advanceFixedHabitat(loaded.state, 2), advanceFixedHabitat(input.state, 2));
  expect((await listHabitats()).map(item => item.id)).toEqual([input.id]);
});

it("adds only when expectedSavedAt is null and rejects overwrite", async () => {
  const original = checkpoint();
  await saveHabitat(original, null);
  const replacement = { ...checkpoint(id1, "Renamed", 300), name: "Renamed" };
  await expect(saveHabitat(replacement, null)).rejects.toThrow(/already|exists|conflict/i);
  deepStrictStrict(await loadHabitat(id1), original);
});

it("atomically compares savedAt and allows a matching update with stable identity", async () => {
  const original = checkpoint();
  await saveHabitat(original, null);
  const update = { ...checkpoint(id1, "Revised name", 200), name: "Revised name" };
  const saved = await saveHabitat(update, 200);
  expect(saved.id).toBe(original.id);
  expect(saved.createdAt).toBe(original.createdAt);
  expect(saved.parentId).toBe(original.parentId);
  expect(saved.name).toBe("Revised name");
  expect(saved.savedAt).toBeGreaterThan(original.savedAt);
  deepStrictEqual(await loadHabitat(id1), saved);
});

it("rejects stale and racing updates while preserving the winning save", async () => {
  const original = checkpoint();
  await saveHabitat(original, null);
  const first = { ...checkpoint(id1, "First", 200), name: "First" };
  const second = { ...checkpoint(id1, "Second", 200), name: "Second" };
  const settled = await Promise.allSettled([saveHabitat(first, 200), saveHabitat(second, 200)]);
  expect(settled.filter(result => result.status === "fulfilled")).toHaveLength(1);
  expect(settled.filter(result => result.status === "rejected")).toHaveLength(1);
  const winner = await loadHabitat(id1);
  expect(["First", "Second"]).toContain(winner.name);
  await expect(saveHabitat(checkpoint(id1, "Stale", 200), 200)).rejects.toThrow(/stale|conflict|changed/i);
  deepStrictStrict(await loadHabitat(id1), winner);
});

it("imports as add-only and duplicate import preserves the existing checkpoint", async () => {
  const original = checkpoint();
  const changed = { ...original, name: "Tampered name" };
  const text = encodeHabitatCheckpoint(original);
  await importHabitat(text);
  await expect(importHabitat(encodeHabitatCheckpoint(changed))).rejects.toThrow(/already|exists|duplicate/i);
  deepStrictStrict(await loadHabitat(id1), original);
});

it("rejects corrupt or incompatible records on every read", async () => {
  const original = checkpoint();
  await saveHabitat(original, null);
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("lifepot-fixed-habitats", 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction("habitats", "readwrite");
    transaction.objectStore("habitats").put({ id: id1, wire: "not-json" });
    transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error);
  });
  db.close();
  await expect(loadHabitat(id1)).rejects.toThrow(/corrupt|unsupported|checkpoint|invalid/i);
  await expect(listHabitats()).rejects.toThrow(/corrupt|unsupported|checkpoint|invalid/i);
  // An update must reject through its promise, not throw out of an IDB event.
  await expect(saveHabitat({ ...original, savedAt: 300 }, original.savedAt)).rejects.toThrow(/corrupt|unsupported/i);
  await expect(loadHabitat(id1)).rejects.toThrow(/corrupt|unsupported/i);
  expect(() => decodeHabitatCheckpoint("{}")).toThrow();
});

it("rejects request success followed by transaction abort and preserves old save", async () => {
  const original = checkpoint();
  await saveHabitat(original, null);
  const put = IDBObjectStore.prototype.put;
  vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (this: IDBObjectStore, ...args: Parameters<typeof put>) {
    const request = put.apply(this, args);
    request.addEventListener("success", () => this.transaction.abort());
    return request;
  });
  await expect(saveHabitat({ ...checkpoint(id1, "Aborted", 200), name: "Aborted" }, 200)).rejects.toThrow(/storage|abort|unavailable/i);
  vi.restoreAllMocks();
  deepStrictStrict(await loadHabitat(id1), original);
});

it("reports quota failures and preserves prior data", async () => {
  const original = checkpoint();
  await saveHabitat(original, null);
  vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(() => { throw new DOMException("Quota exceeded", "QuotaExceededError"); });
  await expect(saveHabitat({ ...checkpoint(id1, "Quota", 200), name: "Quota" }, 200)).rejects.toThrow(/quota|full/i);
  vi.restoreAllMocks();
  deepStrictStrict(await loadHabitat(id1), original);
});

it("deletes by identity and missing loads reject", async () => {
  await expect(loadHabitat(id1)).rejects.toThrow(/not found|missing|does not exist/i);
  await saveHabitat(checkpoint(), null);
  await deleteHabitat(id1);
  expect(await listHabitats()).toEqual([]);
  await expect(loadHabitat(id1)).rejects.toThrow(/not found|missing|does not exist/i);
});

it("does not advance or reseed stored state while opening and loading", async () => {
  const original = checkpoint();
  await saveHabitat(original, null);
  const restored = await loadHabitat(id1);
  expect(restored.state.generation).toBe(original.state.generation);
  expect(restored.state.rngState).toBe(original.state.rngState);
  expect(restored.state.seed).toBe(original.state.seed);
  expect(restored.state.organismId.length).toBe(GRID_CELLS);
  deepStrictStrict(restored, original);
});

it("freezes the encoded input snapshot before asynchronous database opening", async () => {
  const original = checkpoint();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const open = indexedDB.open.bind(indexedDB);
  vi.spyOn(indexedDB, "open").mockImplementation(((...args: Parameters<typeof indexedDB.open>) => {
    const request = open(...args);
    request.addEventListener("upgradeneeded", () => { void gate.then(() => undefined); });
    return request;
  }) as typeof indexedDB.open);
  const pending = saveHabitat(original, null);
  original.name = "Mutated after invocation";
  release();
  const saved = await pending;
  expect(saved.name).toBe("Pond family");
});

it("sorts by savedAt descending", async () => {
  await saveHabitat(checkpoint(id1, "Old", 100), null);
  await saveHabitat(checkpoint(id2, "New", 300), null);
  expect((await listHabitats()).map(item => item.id)).toEqual([id2, id1]);
});

it("reports unavailable IndexedDB without inventing a local fallback", async () => {
  vi.stubGlobal("indexedDB", undefined);
  await expect(listHabitats()).rejects.toThrow(/storage|unavailable/i);
});

function deepStrictStrict(actual: unknown, expected: unknown) { deepStrictEqual(actual, expected); }
