import { z } from "zod";
import {
  DEFAULT_GENERATIONS,
  ENGINE_VERSION,
  CA8_ENGINE_VERSION,
  FEATURE_ENGINE_VERSIONS,
  SUPPORTED_ENGINE_VERSIONS,
  type EngineVersion,
  createSimulation,
  snapshotSimulation,
  stepSimulation,
  type LifeConfig,
  type SimulationState,
} from "./world";
import type { EvolutionLedger } from "./decisions";
import {
  detectDecisionTriggerForRun,
  runWithDecisionLedger,
  runWithPlayerEvents,
  stepWithPlayerEvents,
  validateEvolutionLedger,
} from "./runtime";
import { createRunEvidence, observeRun, type RunEvidence } from "./run-evidence";
import { playerEventSchema, validatePlayerEvents, type AcceptedPlayerEvent } from "./player-proposal";
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
const playerBase = base
  .extend({
    version: z.literal(4),
    engineVersion: z.enum(FEATURE_ENGINE_VERSIONS),
    playerEvents: z.array(playerEventSchema).min(1).max(8),
  })
  .strict();
type Common = {
  engineVersion: EngineVersion;
  answers: SetupAnswers;
  config: LifeConfig;
  seed: number;
  requestHash: string;
  ledger: EvolutionLedger;
  contractHash: string;
};
export type ReplayData = Common &
  ({ version: 3; playerEvents?: never } | { version: 4; playerEvents: AcceptedPlayerEvent[] });
type ReplayInput = {
  answers: SetupAnswers;
  config: LifeConfig;
  seed: number;
  requestHash: string;
  ledger: EvolutionLedger;
  engineVersion?: EngineVersion;
  playerEvents?: AcceptedPlayerEvent[];
};
function body(v: Omit<Common, "contractHash"> & { version: 3 | 4; playerEvents?: AcceptedPlayerEvent[] }) {
  const common = {
    version: v.version,
    engineVersion: v.engineVersion,
    answers: canonicalAnswers(v.answers),
    config: v.config,
    seed: v.seed >>> 0,
    requestHash: v.requestHash,
    ledger: v.ledger,
  };
  return v.version === 4 ? { ...common, playerEvents: v.playerEvents } : common;
}
// Proving a replay means re-running all of its generations. The proven terminal state is kept
// under the replay's full canonical content, so creating a replay, encoding it and decoding it
// again (as saving a world does) simulates it once. Keying by content, not by object or by the
// short contract hash, means a changed replay can never reuse another replay's proof. The
// states held here never leave this module; playReplay hands out copies.
const PROVEN_LIMIT = 8;
const proven = new Map<string, SimulationState>();
function validate(input: unknown): { replay: ReplayData; state: SimulationState } {
  try {
    const p = z.discriminatedUnion("version", [base, playerBase]).parse(input),
      ledger = validateEvolutionLedger(p.ledger);
    const r = (
      p.version === 4 ? { ...p, ledger, playerEvents: validatePlayerEvents(p.playerEvents) } : { ...p, ledger }
    ) as ReplayData;
    if (r.requestHash !== hashSetupRequest(r.answers) || r.contractHash !== hashReplayPayload(body(r)))
      throw new Error("tampered");
    const key = JSON.stringify(r);
    let state = proven.get(key);
    if (!state) {
      const initial = createSimulation({ seed: r.seed, config: r.config, engineVersion: r.engineVersion });
      state =
        r.version === 4
          ? runWithPlayerEvents(initial, ledger, r.playerEvents, r.answers)
          : runWithDecisionLedger(initial, ledger, DEFAULT_GENERATIONS, r.answers);
      if (proven.size >= PROVEN_LIMIT) proven.delete(proven.keys().next().value!);
      proven.set(key, state);
    }
    return { replay: r, state };
  } catch {
    throw new Error("Invalid, tampered, or unsupported LifePot replay");
  }
}
export function createReplay(input: ReplayInput): ReplayData {
  const events = input.playerEvents?.length ? validatePlayerEvents(input.playerEvents) : undefined;
  const b = body({
    version: events ? 4 : 3,
    engineVersion: input.engineVersion ?? ENGINE_VERSION,
    answers: input.answers,
    config: lifeConfigSchema.parse(input.config),
    seed: input.seed,
    requestHash: input.requestHash,
    ledger: validateEvolutionLedger(input.ledger),
    ...(events ? { playerEvents: events } : {}),
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
  const { replay, state: cached } = validate(input);
  // The proven state stays private to the cache. Callers get an independent deep copy, typed
  // arrays and nested objects included, so changing a playback result cannot alter a later one.
  const state = structuredClone(cached);
  return { replay, state, snapshot: snapshotSimulation(state) };
}
export type ReplayInspection = { state: SimulationState; evidence: RunEvidence };
/** Reconstruct one inclusive generation from validated recorded inputs, with only observed run evidence. */
export function inspectReplayAtGeneration(input: ReplayData, generation: number): ReplayInspection {
  if (!Number.isInteger(generation) || generation < 0 || generation > DEFAULT_GENERATIONS)
    throw new Error("Generation is outside this recording");
  // Full validation is intentional: future entries must also be canonical, reachable, and executed.
  const { replay, state: terminal } = validate(input);
  if (generation > terminal.generation) throw new Error("Generation is outside this recording");
  let state = createSimulation({ seed: replay.seed, config: replay.config, engineVersion: replay.engineVersion });
  let evidence = createRunEvidence(state),
    decisionIndex = 0,
    eventIndex = 0;
  const accepted: EvolutionLedger = [],
    acceptedEvents: AcceptedPlayerEvent[] = [];
  while (state.generation < generation && state.outcome === "running") {
    const trigger = detectDecisionTriggerForRun(state, accepted, acceptedEvents);
    if (trigger) {
      const decision = replay.ledger[decisionIndex];
      if (!decision) throw new Error("Invalid replay decision prefix");
      accepted.push(decision);
      decisionIndex++;
    }
    const events = replay.version === 4 ? replay.playerEvents : [];
    if (events[eventIndex]?.acceptedGeneration === state.generation) {
      acceptedEvents.push(events[eventIndex]);
      eventIndex++;
    }
    state = stepWithPlayerEvents(state, accepted, acceptedEvents);
    evidence = observeRun(evidence, state, events);
  }
  if (state.generation !== generation) throw new Error("Generation is outside this recording");
  return { state, evidence };
}
// Counterfactual only; supported v3 records retain the original explicit behavior.
// Pinned to ca-8, the energy-accounting correction this comparison was written for, so a
// saved counterfactual stays stable when a later contract becomes current.
export function replayCounterfactual(input: ReplayData) {
  if (input.version !== 3) throw new Error("Player-directed recordings are not supported by this counterfactual");
  const replay = base.parse(input),
    ledger = validateEvolutionLedger(replay.ledger);
  let state = createSimulation({ seed: replay.seed, config: replay.config, engineVersion: CA8_ENGINE_VERSION });
  while (state.outcome === "running" && state.generation < DEFAULT_GENERATIONS) {
    const active = ledger.filter((d) => d.generation <= state.generation).at(-1);
    state = stepSimulation(state, active, ledger);
  }
  return state;
}
