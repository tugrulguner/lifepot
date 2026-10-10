import { z } from "zod";
import { decodeReplay, encodeReplay, type ReplayData } from "./replay";
import { createRunEvidence, observeRun, type RunEvidence } from "./run-evidence";
import { setupNamedIntentSchema, type SetupNamedIntent } from "./setup-review";
import { createSimulation, stepSimulation } from "./world";
import { activeDecisionForGeneration } from "./runtime";

const DB_NAME = "lifepot-my-worlds";
export const MAX_WORLD_EXPORT_BYTES = 512_000;
const integer = z.number().int().nonnegative();
const generation = integer.max(180);
const species = z.object({ speciesId: z.enum(["A", "B", "C", "D"]), role: z.string().max(32), population: integer.max(2500) }).strict();
const sample = z.object({ generation, population: integer.max(2500), prey: integer.max(2500), predators: integer.max(2500), resources: z.number().finite().min(0).max(637500), births: integer, deaths: integer, kills: integer, species: z.array(species).min(2).max(4) }).strict();
const evidenceSchema = z.object({
  samples: z.array(sample).min(1).max(181), firstExtinction: z.array(z.object({ speciesId: z.enum(["A", "B", "C", "D"]), generation }).strict()).max(4),
  peakPopulation: integer.max(2500), lineageExtinction: z.array(z.object({ lineage: integer.min(1), generation }).strict()).max(100),
  ruleEvents: z.array(z.discriminatedUnion("kind", [z.object({ kind: z.literal("activated"), generation, sourceGeneration: generation, revertAt: integer.nullable() }).strict(), z.object({ kind: z.literal("reverted"), generation }).strict()])).max(360),
  observedRuleVersion: integer.min(1), followedFamily: z.object({ lineage: integer.min(1), population: integer.max(2500) }).strict().nullable(), activeRuleIdentity: z.string().max(100).nullable().optional(),
}).strict();
const idSchema = z.string().uuid();
const provenanceSchema = z.object({ source: z.enum(["jev", "fallback"]), model: z.string().max(100).optional(), namedIntent: setupNamedIntentSchema.optional() }).strict();
const portableSchema = z.object({
  format: z.literal("lifepot-world"), version: z.literal(1), id: idSchema, name: z.string().trim().min(1).max(80), replay: z.string().min(1).max(MAX_WORLD_EXPORT_BYTES),
  evidence: evidenceSchema, outcome: z.enum(["surviving", "thriving", "extinct"]), stopReason: z.enum(["World empty", "Observation horizon reached"]),
  parentId: idSchema.nullable(), createdAt: integer.max(8_640_000_000_000_000), setup: provenanceSchema.optional(), policy: z.enum(["adaptive", "fixed", "recorded"]).optional(),
}).strict();
export type WorldRecord = { id: string; name: string; createdAt: number; replay: ReplayData; evidence: RunEvidence; outcome: "surviving" | "thriving" | "extinct"; stopReason: string; parentId: string | null; setup?: { source: "jev" | "fallback"; model?: string; namedIntent?: SetupNamedIntent }; policy?: "adaptive" | "fixed" | "recorded" };

function storageError(error: unknown): Error {
  const name = error && typeof error === "object" && "name" in error ? error.name : "";
  if (name === "QuotaExceededError") return new Error("Browser storage quota is full. Export a backup and delete an unwanted save before trying again.");
  if (name === "ConstraintError") return new Error("This world is already saved in this browser. No existing world was overwritten.");
  return new Error("Browser-local world storage is unavailable or the write was aborted. Your existing saves have not been changed.");
}
function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(storageError(null));
  return new Promise((resolve, reject) => {
    let rejected = false;
    let request: IDBOpenDBRequest;
    try { request = indexedDB.open(DB_NAME, 1); } catch (error) { reject(storageError(error)); return; }
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains("worlds")) request.result.createObjectStore("worlds", { keyPath: "id" }); };
    request.onblocked = () => { rejected = true; reject(new Error("World storage is blocked by another open tab. Close other LifePot tabs and retry.")); };
    request.onerror = () => reject(storageError(request.error));
    request.onsuccess = () => { const db = request.result; if (rejected) { db.close(); return; } db.onversionchange = () => db.close(); resolve(db); };
  });
}
async function transact<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    let transaction: IDBTransaction;
    try { transaction = db.transaction("worlds", mode); } catch (error) { db.close(); reject(storageError(error)); return; }
    let result: T;
    transaction.oncomplete = () => { db.close(); resolve(result); };
    transaction.onabort = () => { db.close(); reject(storageError(transaction.error)); };
    transaction.onerror = () => { /* Failure is reported only once the transaction aborts. */ };
    try {
      const request = operation(transaction.objectStore("worlds"));
      request.onsuccess = () => { result = request.result; };
    } catch (error) { transaction.abort(); db.close(); reject(storageError(error)); }
  });
}
type ReplayArtifact = { replay: ReplayData; encoded: string; evidence: RunEvidence; outcome: WorldRecord["outcome"]; families: Map<number, Map<number, number>> };
// Cache only completely validated inputs, keyed by their complete serialization.
// Returning clones prevents a caller from mutating validated cache contents.
const replayCache = new Map<string, ReplayArtifact>();
function replayArtifact(input: ReplayData | string): ReplayArtifact {
  const key = typeof input === "string" ? input : JSON.stringify(input);
  const cached = replayCache.get(key); if (cached) return cached;
  const encoded = typeof input === "string" ? input : encodeReplay(input);
  const replay = decodeReplay(encoded);
  let state = createSimulation({ seed: replay.seed, config: replay.config, engineVersion: replay.engineVersion });
  let evidence = createRunEvidence(state);
  const families = new Map<number, Map<number, number>>();
  const countFamilies = () => {
    const counts = new Map<number, number>();
    for (let index = 0; index < state.guild.length; index++) if (state.guild[index]) counts.set(state.lineage[index], (counts.get(state.lineage[index]) ?? 0) + 1);
    families.set(state.generation, counts);
  };
  countFamilies();
  while (state.outcome === "running") {
    state = stepSimulation(state, activeDecisionForGeneration(replay.ledger, state.generation), replay.ledger);
    evidence = observeRun(evidence, state); countFamilies();
  }
  const artifact = { replay, encoded, evidence, outcome: state.outcome, families };
  if (replayCache.size >= 64) replayCache.clear();
  replayCache.set(key, artifact); replayCache.set(encoded, artifact);
  return artifact;
}
function validateRecord(input: unknown): WorldRecord {
  const parsed = portableSchema.parse(input), canonical = replayArtifact(parsed.replay);
  for (const key of ["samples", "firstExtinction", "peakPopulation", "ruleEvents", "observedRuleVersion", "activeRuleIdentity"] as const) {
    if (JSON.stringify(parsed.evidence[key] ?? null) !== JSON.stringify(canonical.evidence[key] ?? null)) throw new Error("Saved evidence does not match the recorded replay.");
  }
  if (canonical.outcome !== parsed.outcome || parsed.stopReason !== (parsed.outcome === "extinct" ? "World empty" : "Observation horizon reached")) throw new Error("Saved outcome does not match the recorded replay.");
  const familyCount = (at: number, lineage: number) => canonical.families.get(at)?.get(lineage) ?? 0;
  if (parsed.evidence.lineageExtinction.some(event => familyCount(event.generation - 1, event.lineage) === 0 || familyCount(event.generation, event.lineage) !== 0)) throw new Error("Saved family milestone does not match the replay.");
  const followed = parsed.evidence.followedFamily;
  if (followed && followed.population !== familyCount(parsed.evidence.samples.at(-1)!.generation, followed.lineage)) throw new Error("Saved followed-family count does not match the replay.");
  return { id: parsed.id, name: parsed.name, createdAt: parsed.createdAt, replay: structuredClone(canonical.replay), evidence: parsed.evidence, outcome: parsed.outcome, stopReason: parsed.stopReason, parentId: parsed.parentId, ...(parsed.setup ? { setup: parsed.setup } : {}), ...(parsed.policy ? { policy: parsed.policy } : {}) };
}
function checkSize(text: string) { if (new TextEncoder().encode(text).byteLength > MAX_WORLD_EXPORT_BYTES) throw new Error("LifePot world export exceeds the 512 KB size limit."); }
function portable(record: WorldRecord) {
  return { format: "lifepot-world" as const, version: 1 as const, id: record.id, name: record.name, replay: replayArtifact(record.replay).encoded, evidence: record.evidence, outcome: record.outcome, stopReason: record.stopReason, parentId: record.parentId, createdAt: record.createdAt, ...(record.setup ? { setup: record.setup } : {}), ...(record.policy ? { policy: record.policy } : {}) };
}
export async function listWorlds(): Promise<WorldRecord[]> {
  const rows = await transact<unknown[]>("readonly", store => store.getAll());
  try { return rows.map(validateRecord).sort((a, b) => b.createdAt - a.createdAt); }
  catch { throw new Error("A saved world is corrupt or unsupported. Existing records were not changed. Clear this site's storage only after backing up any exports you already have."); }
}
export async function saveWorld(input: Omit<WorldRecord, "id" | "createdAt" | "name">, name: string): Promise<WorldRecord> {
  const record = { ...input, id: crypto.randomUUID(), name: name.trim() || "Unnamed world", createdAt: Date.now() };
  const encoded = portable(record), text = JSON.stringify(encoded); checkSize(text);
  const validated = validateRecord(encoded);
  await transact("readwrite", store => store.add(encoded));
  return validated;
}
export async function deleteWorld(id: string): Promise<undefined> { idSchema.parse(id); return transact("readwrite", store => store.delete(id)); }
export function exportWorld(record: WorldRecord): string {
  const encoded = portable(record); validateRecord(encoded); const text = JSON.stringify(encoded); checkSize(text); return text;
}
export async function importWorld(text: string): Promise<WorldRecord> {
  checkSize(text);
  let record: WorldRecord;
  try { record = validateRecord(JSON.parse(text)); } catch { throw new Error("Invalid or unsupported LifePot world export; nothing was imported."); }
  await transact("readwrite", store => store.add(portable(record)));
  return record;
}
