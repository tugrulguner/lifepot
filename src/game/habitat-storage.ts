import { decodeHabitatCheckpoint, encodeHabitatCheckpoint, type HabitatCheckpoint } from "./habitat-checkpoint";

const DB_NAME = "lifepot-fixed-habitats";
const STORE_NAME = "habitats";
type StoredHabitat = { id: string; wire: string };

function storageError(error: unknown): Error {
  const name = error && typeof error === "object" && "name" in error ? error.name : "";
  if (name === "QuotaExceededError") return new Error("Browser storage quota is full. Existing habitat saves have not been changed.");
  if (name === "ConstraintError") return new Error("A habitat with this identity already exists. No existing save was overwritten.");
  return new Error("Browser-local habitat storage is unavailable or the transaction was aborted. Existing saves have not been changed.");
}

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(storageError(null));
  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    let rejected = false;
    try { request = indexedDB.open(DB_NAME, 1); }
    catch (error) { reject(storageError(error)); return; }
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onblocked = () => {
      rejected = true;
      reject(new Error("Habitat storage is blocked by another tab. Close other LifePot tabs and retry."));
    };
    request.onerror = () => reject(storageError(request.error));
    request.onsuccess = () => {
      const db = request.result;
      if (rejected) { db.close(); return; }
      db.onversionchange = () => db.close();
      resolve(db);
    };
  });
}

type TransactionResult<T> = {
  result: T;
  failure?: Error;
};
function transact<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore, transaction: IDBTransaction, setResult: (result: T) => void, fail: (error: Error) => void) => void): Promise<T> {
  return openDb().then(db => new Promise<T>((resolve, reject) => {
    let transaction: IDBTransaction;
    const outcome: TransactionResult<T> = { result: undefined as T };
    try { transaction = db.transaction(STORE_NAME, mode); }
    catch (error) { db.close(); reject(storageError(error)); return; }
    transaction.oncomplete = () => {
      db.close();
      if (outcome.failure) reject(outcome.failure);
      else resolve(outcome.result);
    };
    transaction.onabort = () => { db.close(); reject(outcome.failure ?? storageError(transaction.error)); };
    transaction.onerror = () => { /* Wait for abort; only transaction completion establishes success. */ };
    const setResult = (result: T) => { outcome.result = result; };
    const fail = (error: Error) => { outcome.failure = error; try { transaction.abort(); } catch { db.close(); reject(error); } };
    try { operation(transaction.objectStore(STORE_NAME), transaction, setResult, fail); }
    catch (error) { fail(error instanceof Error && !(error instanceof DOMException) ? error : storageError(error)); }
  }));
}

function decodeStored(row: unknown): HabitatCheckpoint {
  if (!row || typeof row !== "object" || !("id" in row) || !("wire" in row) || typeof row.id !== "string" || typeof row.wire !== "string") {
    throw new Error("Saved habitat is corrupt or unsupported; existing records were not changed.");
  }
  try {
    const checkpoint = decodeHabitatCheckpoint(row.wire);
    if (checkpoint.id !== row.id) throw new Error("Stored habitat identity does not match its key.");
    return checkpoint;
  } catch {
    throw new Error("A saved habitat is corrupt or unsupported. Existing records were not changed.");
  }
}

export async function listHabitats(): Promise<HabitatCheckpoint[]> {
  const rows = await transact<unknown[]>("readonly", (store, _transaction, setResult) => {
    const request = store.getAll();
    request.onsuccess = () => setResult(request.result);
  });
  return rows.map(decodeStored).sort((a, b) => b.savedAt - a.savedAt);
}

export async function loadHabitat(id: string): Promise<HabitatCheckpoint> {
  const row = await transact<unknown | undefined>("readonly", (store, _transaction, setResult) => {
    const request = store.get(id);
    request.onsuccess = () => setResult(request.result);
  });
  if (row === undefined) throw new Error("Saved habitat was not found.");
  return decodeStored(row);
}

export async function saveHabitat(checkpoint: HabitatCheckpoint, expectedSavedAt: number | null): Promise<HabitatCheckpoint> {
  // Encoding synchronously snapshots and validates caller-owned data before any DB open await.
  const inputWire = encodeHabitatCheckpoint(checkpoint);
  const input = decodeHabitatCheckpoint(inputWire);
  let saved = input;
  await transact<void>("readwrite", (store, transaction, _setResult, fail) => {
    const request = store.get(input.id);
    request.onsuccess = () => {
      const existingRow = request.result as StoredHabitat | undefined;
      if (expectedSavedAt === null) {
        if (existingRow) { fail(new Error("A habitat with this identity already exists. No existing save was overwritten.")); return; }
        try { store.add({ id: input.id, wire: inputWire }); }
        catch (error) { fail(storageError(error)); }
        return;
      }
      if (!existingRow) { fail(new Error("Habitat save is stale or missing; no existing save was changed.")); return; }
      let previous: HabitatCheckpoint;
      try { previous = decodeStored(existingRow); }
      catch (error) { fail(error instanceof Error ? error : storageError(error)); return; }
      if (previous.savedAt !== expectedSavedAt || input.id !== previous.id || input.createdAt !== previous.createdAt || input.parentId !== previous.parentId) {
        fail(new Error("Habitat save is stale or conflicts with stable identity fields; no existing save was changed."));
        return;
      }
      const nextSavedAt = Math.max(Date.now(), previous.savedAt + 1);
      if (!Number.isSafeInteger(nextSavedAt) || nextSavedAt > 8_640_000_000_000_000) {
        fail(new Error("Habitat save timestamp cannot be advanced safely; no existing save was changed."));
        return;
      }
      saved = { ...input, savedAt: nextSavedAt };
      try { store.put({ id: saved.id, wire: encodeHabitatCheckpoint(saved) }); }
      catch (error) { fail(storageError(error)); }
    };
  });
  return saved;
}

export async function importHabitat(text: string): Promise<HabitatCheckpoint> {
  const checkpoint = decodeHabitatCheckpoint(text);
  const wire = encodeHabitatCheckpoint(checkpoint);
  await transact<void>("readwrite", store => { store.add({ id: checkpoint.id, wire }); });
  return decodeHabitatCheckpoint(wire);
}

export async function deleteHabitat(id: string): Promise<void> {
  await transact<void>("readwrite", store => { store.delete(id); });
}
