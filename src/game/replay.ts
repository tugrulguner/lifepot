import { z } from "zod";
import {
  DEFAULT_GENERATIONS,
  ENGINE_VERSION,
  CA8_ENGINE_VERSION,
  SUPPORTED_ENGINE_VERSIONS,
  type EngineVersion,
  createSimulation,
  snapshotSimulation,
  stepSimulation,
  type LifeConfig,
  type SimulationState,
} from "./world";
import type { EvolutionLedger } from "./decisions";
import { runWithDecisionLedger, validateEvolutionLedger } from "./runtime";
import {
  canonicalAnswers,
  hashReplayPayload,
  hashSetupRequest,
  lifeConfigSchema,
  setupAnswersSchema,
  type SetupAnswers,
} from "./setup";
const base = z
  .object({
    version: z.literal(3),
    engineVersion: z.enum(SUPPORTED_ENGINE_VERSIONS),
    answers: setupAnswersSchema,
    config: lifeConfigSchema,
    seed: z.number().int().min(0).max(0xffffffff),
    requestHash: z.string().regex(/^setup_[a-z0-9]+$/),
    ledger: z.array(z.unknown()).max(8),
    contractHash: z.string().regex(/^replay_[a-z0-9]+$/),
  })
  .strict();
export type ReplayData = {
  version: 3;
  engineVersion: EngineVersion;
  answers: SetupAnswers;
  config: LifeConfig;
  seed: number;
  requestHash: string;
  ledger: EvolutionLedger;
  contractHash: string;
};
type Body = Omit<ReplayData, "contractHash">;
function body(v: Body): Body {
  return {
    version: 3,
    engineVersion: v.engineVersion,
    answers: canonicalAnswers(v.answers),
    config: v.config,
    seed: v.seed >>> 0,
    requestHash: v.requestHash,
    ledger: v.ledger,
  };
}
// Proving a replay means re-running all of its generations. A replay object that was already
// proven is not simulated again as long as its contract hash still matches its content, so
// creating, encoding and saving one finished run costs a single simulation instead of three.
const proven = new WeakMap<object, { contractHash: string; state: SimulationState }>();
function validate(input: unknown): { replay: ReplayData; state: SimulationState } {
  try {
    const p = base.parse(input);
    const ledger = validateEvolutionLedger(p.ledger);
    const r = { ...p, ledger } as ReplayData;
    const b = body(r);
    if (r.requestHash !== hashSetupRequest(r.answers) || r.contractHash !== hashReplayPayload(b))
      throw new Error("tampered");
    const known = typeof input === "object" && input !== null ? proven.get(input) : undefined;
    const state =
      known?.contractHash === r.contractHash
        ? known.state
        : runWithDecisionLedger(
            createSimulation({ seed: r.seed, config: r.config, engineVersion: r.engineVersion }),
            ledger,
            DEFAULT_GENERATIONS,
            r.answers,
          );
    proven.set(r, { contractHash: r.contractHash, state });
    return { replay: r, state };
  } catch {
    throw new Error("Invalid, tampered, or unsupported LifePot replay v3");
  }
}
export function createReplay(input: {
  answers: SetupAnswers;
  config: LifeConfig;
  seed: number;
  requestHash: string;
  ledger: EvolutionLedger;
  engineVersion?: EngineVersion;
}): ReplayData {
  const b = body({
    version: 3,
    engineVersion: input.engineVersion ?? ENGINE_VERSION,
    answers: input.answers,
    config: lifeConfigSchema.parse(input.config),
    seed: input.seed,
    requestHash: input.requestHash,
    ledger: validateEvolutionLedger(input.ledger),
  });
  if (b.requestHash !== hashSetupRequest(b.answers)) throw new Error("Invalid request hash");
  return validate({ ...b, contractHash: hashReplayPayload(b) }).replay;
}
function enc(text: string) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, " ").trim();
}
function dec(text: string) {
  const b = text.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(b.padEnd(Math.ceil(b.length / 4) * 4, "="));
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}
export function encodeReplay(input: ReplayData) {
  return enc(JSON.stringify(validate(input).replay));
}
export function decodeReplay(payload: string) {
  try {
    return validate(JSON.parse(dec(payload))).replay;
  } catch {
    throw new Error("Invalid or unsupported LifePot replay");
  }
}
// Share links carry the same replay JSON, deflated. A finished run's ledger repeats every
// probability map, so the plain form is roughly 14,000 characters; the compact form is a
// fraction of that. Plain payloads (older links, saved worlds) still decode.
const COMPACT_PREFIX = "z1.";
function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
function fromBase64Url(text: string) {
  const b = text.replaceAll("-", "+").replaceAll("_", "/");
  return Uint8Array.from(atob(b.padEnd(Math.ceil(b.length / 4) * 4, "=")), (c) => c.charCodeAt(0));
}
const MAX_LINK_JSON_BYTES = 262144;
// Reads at most MAX_LINK_JSON_BYTES so a crafted link cannot inflate without bound.
async function pipe(bytes: Uint8Array, transform: CompressionStream | DecompressionStream) {
  const reader = new Blob([bytes as BlobPart]).stream().pipeThrough(transform).getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_LINK_JSON_BYTES) {
      await reader.cancel();
      throw new Error("oversized");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}
export async function encodeReplayLink(input: ReplayData): Promise<string> {
  const json = JSON.stringify(validate(input).replay);
  if (typeof CompressionStream === "undefined") return enc(json);
  try {
    return (
      COMPACT_PREFIX + toBase64Url(await pipe(new TextEncoder().encode(json), new CompressionStream("deflate-raw")))
    );
  } catch {
    return enc(json);
  }
}
export async function decodeReplayLink(payload: string): Promise<ReplayData> {
  if (!payload.startsWith(COMPACT_PREFIX)) return decodeReplay(payload);
  try {
    if (typeof DecompressionStream === "undefined") throw new Error("unsupported");
    const bytes = await pipe(
      fromBase64Url(payload.slice(COMPACT_PREFIX.length)),
      new DecompressionStream("deflate-raw"),
    );
    return validate(JSON.parse(new TextDecoder().decode(bytes))).replay;
  } catch {
    throw new Error("Invalid or unsupported LifePot replay");
  }
}
export async function playReplay(input: ReplayData, _interpreter?: (...args: never[]) => unknown) {
  void _interpreter;
  const { replay, state } = validate(input);
  return { replay, state, snapshot: snapshotSimulation(state) };
}
// Counterfactual only: retain recorded proposal timing/content, but intentionally skip
// ca7 observation-hash matching because corrected mechanics alter those observations.
// Pinned to ca-8, the energy-accounting correction this comparison was written for, so a
// saved counterfactual stays stable when a later contract becomes current.
export function replayCounterfactual(input: ReplayData) {
  const replay = base.parse(input);
  const ledger = validateEvolutionLedger(replay.ledger);
  let state = createSimulation({ seed: replay.seed, config: replay.config, engineVersion: CA8_ENGINE_VERSION });
  while (state.outcome === "running" && state.generation < DEFAULT_GENERATIONS) {
    const active = ledger.filter((decision) => decision.generation <= state.generation).at(-1);
    state = stepSimulation(state, active, ledger);
  }
  return state;
}
