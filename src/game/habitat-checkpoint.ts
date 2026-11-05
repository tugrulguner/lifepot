import { sha256 } from "@noble/hashes/sha2.js";
import { validateHabitatCheckpoint } from "./habitat-checkpoint-validation";
import { GRID_CELLS, TRAIT_COUNT, type SimulationState } from "./world";
import type { RunEvidence } from "./run-evidence";
import type { SetupNamedIntent } from "./setup-review";

export type HabitatCheckpointInput = { id: string; name: string; createdAt: number; savedAt: number; parentId: string | null; state: SimulationState; evidence: RunEvidence; setup?: { source: "jev" | "fallback"; starter?: boolean; model?: string; namedIntent?: SetupNamedIntent } };
export type HabitatCheckpoint = HabitatCheckpointInput & { format: "lifepot-habitat"; version: 1 };
export const MAX_HABITAT_CHECKPOINT_BYTES = 8 * 1024 * 1024;
const MAX_WIRE_DEPTH = 128, MAX_WIRE_NODES = 1_000_000;
function checkWire(text: string): void {
  if (text.length > MAX_HABITAT_CHECKPOINT_BYTES || new TextEncoder().encode(text).byteLength > MAX_HABITAT_CHECKPOINT_BYTES) throw new Error("Habitat checkpoint exceeds the 8 MiB size limit");
  let depth = 0, quoted = false, escaped = false, nodes = 0;
  for (const character of text) {
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') quoted = false;
    } else if (character === '"') quoted = true;
    else if (character === "[" || character === "{") {
      depth += 1; nodes += 1;
      if (depth > MAX_WIRE_DEPTH || nodes > MAX_WIRE_NODES) throw new Error("Habitat checkpoint nesting depth or structure limit exceeded");
    } else if (character === "]" || character === "}") depth -= 1;
  }
}
function checkNodes(value: unknown): void {
  const pending = [value]; let count = 0;
  while (pending.length) {
    const item = pending.pop();
    if (++count > MAX_WIRE_NODES) throw new Error("Habitat checkpoint structure limit exceeded");
    if (Array.isArray(item)) for (const child of item) pending.push(child);
  }
}
type Packed = ["u"] | ["z"] | ["v", null | boolean | number | string] | ["a", Packed[]] | ["o", Array<[string, Packed]>] | ["t", string, string];
const arrays = { Uint8Array, Uint16Array, Uint32Array, Float32Array };
function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let start = 0; start < bytes.length; start += 8192) binary += String.fromCharCode(...bytes.subarray(start, start + 8192));
  return btoa(binary);
}
function assertEncodable(value: unknown, ancestors = new Set<object>(), depth = 0): void {
  if (depth > MAX_WIRE_DEPTH) throw new Error("Checkpoint nesting depth exceeded");
  if (!value || typeof value !== "object") return;
  if (ancestors.has(value)) throw new Error("Cyclic checkpoint value is unsupported");
  if (ArrayBuffer.isView(value)) {
    const length = (value as unknown as ArrayLike<number>).length;
    if (!Number.isInteger(length) || Reflect.ownKeys(value).length !== length) throw new Error("Unsupported checkpoint array property");
    return;
  }
  ancestors.add(value);
  const keys = Reflect.ownKeys(value);
  if (Array.isArray(value)) {
    if (keys.length !== value.length + 1) throw new Error("Unsupported checkpoint array property");
    for (const entry of value) assertEncodable(entry, ancestors, depth + 1);
  } else {
    if (Object.getPrototypeOf(value) !== Object.prototype || keys.length !== Object.keys(value).length) throw new Error("Unsupported checkpoint object property");
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
      if (typeof key !== "string" || !descriptor.enumerable || !("value" in descriptor)) throw new Error("Unsupported checkpoint object property");
      assertEncodable(descriptor.value, ancestors, depth + 1);
    }
  }
  ancestors.delete(value);
}
function pack(value: unknown): Packed {
  if (value === undefined) return ["u"];
  if (typeof value === "number" && Object.is(value, -0)) return ["z"];
  if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value)) return ["v", value];
  if (ArrayBuffer.isView(value)) {
    const name = value.constructor.name;
    const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    if (!Object.hasOwn(arrays, name) || value.constructor !== arrays[name as keyof typeof arrays]) throw new Error("Unsupported checkpoint array type");
    return ["t", name, toBase64(bytes)];
  }
  if (Array.isArray(value)) return ["a", value.map(pack)];
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) return ["o", Object.entries(value).map(([key, entry]) => [key, pack(entry)])];
  throw new Error("Unsupported checkpoint value");
}
function unpack(value: unknown): unknown {
  if (!Array.isArray(value)) throw new Error("Invalid checkpoint value");
  const [kind, data, encoded] = value;
  if (kind === "u" && value.length === 1) return undefined;
  if (kind === "z" && value.length === 1) return -0;
  if (kind === "v" && value.length === 2 && (data === null || typeof data === "string" || typeof data === "boolean" || typeof data === "number" && Number.isFinite(data))) return data;
  if (kind === "a" && value.length === 2 && Array.isArray(data)) return data.map(unpack);
  if (kind === "o" && value.length === 2 && Array.isArray(data)) {
    const object: Record<string, unknown> = {};
    for (const pair of data) {
      if (!Array.isArray(pair) || pair.length !== 2 || typeof pair[0] !== "string" || Object.hasOwn(object, pair[0])) throw new Error("Invalid checkpoint object");
      Object.defineProperty(object, pair[0], { value: unpack(pair[1]), enumerable: true, writable: true, configurable: true });
    }
    return object;
  }
  if (kind === "t" && value.length === 3 && typeof data === "string" && Object.hasOwn(arrays, data) && typeof encoded === "string") {
    if (encoded.length > Math.ceil(GRID_CELLS * TRAIT_COUNT * 4 / 3) * 4) throw new Error("Invalid checkpoint array size");
    const bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
    const constructor = arrays[data as keyof typeof arrays];
    if (bytes.length % constructor.BYTES_PER_ELEMENT) throw new Error("Invalid checkpoint array length");
    return new constructor(bytes.buffer);
  }
  throw new Error("Invalid checkpoint value");
}
export function createHabitatCheckpoint(input: HabitatCheckpointInput): HabitatCheckpoint {
  assertEncodable(input);
  const checkpoint = { format: "lifepot-habitat", version: 1, ...structuredClone(input) };
  validateHabitatCheckpoint(checkpoint);
  return checkpoint;
}
function checksum(payload: unknown): string {
  return Array.from(sha256(new TextEncoder().encode(JSON.stringify(payload))), byte => byte.toString(16).padStart(2, "0")).join("");
}
export function encodeHabitatCheckpoint(checkpoint: HabitatCheckpoint): string {
  assertEncodable(checkpoint);
  validateHabitatCheckpoint(checkpoint);
  const payload = pack(checkpoint);
  checkNodes(payload);
  const text = JSON.stringify({ format: "lifepot-habitat", version: 1, checksum: checksum(payload), payload });
  checkWire(text);
  return text;
}
export function decodeHabitatCheckpoint(text: string): HabitatCheckpoint {
  checkWire(text);
  const envelope = JSON.parse(text) as { format?: unknown; version?: unknown; checksum?: unknown; payload?: unknown };
  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope) || Object.keys(envelope).length !== 4 || !["format", "version", "checksum", "payload"].every(key => Object.hasOwn(envelope, key)) || envelope.format !== "lifepot-habitat" || envelope.version !== 1) throw new Error("Unsupported habitat checkpoint format or version");
  checkNodes(envelope.payload);
  if (typeof envelope.checksum !== "string" || envelope.checksum !== checksum(envelope.payload)) throw new Error("Habitat checkpoint checksum integrity failed");
  const checkpoint = unpack(envelope.payload) as HabitatCheckpoint;
  validateHabitatCheckpoint(checkpoint);
  return checkpoint;
}
