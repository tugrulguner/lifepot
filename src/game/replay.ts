import { z } from "zod";
import { DEFAULT_GENERATIONS, ENGINE_VERSION, createSimulation, snapshotSimulation, type LifeConfig } from "./world";
import { DECISION_EPOCHS, type EpochLedger } from "./decisions";
import { runWithDecisionLedger, validateEpochLedger } from "./runtime";
import { canonicalAnswers, hashReplayPayload, hashSetupRequest, lifeConfigSchema, setupAnswersSchema, type SetupAnswers } from "./setup";

const replayBaseSchema = z.object({
  version: z.literal(2), engineVersion: z.literal(ENGINE_VERSION), answers: setupAnswersSchema, config: lifeConfigSchema,
  seed: z.number().int().min(0).max(0xffff_ffff), requestHash: z.string().regex(/^setup_[a-z0-9]+$/),
  ledger: z.array(z.unknown()).min(1).max(DECISION_EPOCHS.length), contractHash: z.string().regex(/^replay_[a-z0-9]+$/),
}).strict();
export type ReplayData = {
  version: 2; engineVersion: typeof ENGINE_VERSION; answers: SetupAnswers; config: LifeConfig; seed: number;
  requestHash: string; ledger: EpochLedger; contractHash: string;
};
type ReplayBody = Omit<ReplayData, "contractHash">;
function contractBody(value: ReplayBody): ReplayBody {
  return { version: value.version, engineVersion: value.engineVersion, answers: canonicalAnswers(value.answers), config: value.config, seed: value.seed >>> 0, requestHash: value.requestHash, ledger: value.ledger };
}
function validateReplay(input: unknown): ReplayData {
  try {
    const parsed = replayBaseSchema.parse(input);
    const ledger = validateEpochLedger(parsed.ledger);
    if (ledger.some((decision, index) => decision.generation !== DECISION_EPOCHS[index])) throw new Error("noncanonical ledger");
    const replay: ReplayData = { ...parsed, ledger };
    const body = contractBody(replay);
    if (replay.requestHash !== hashSetupRequest(replay.answers) || replay.contractHash !== hashReplayPayload(body)) throw new Error("tampered");
    // A ledger prefix is valid only when the recorded decisions make all later
    // epochs unreachable (currently, because the population became extinct).
    runWithDecisionLedger(createSimulation({ seed: replay.seed, config: replay.config }), replay.ledger, DEFAULT_GENERATIONS);
    return replay;
  } catch {
    throw new Error("Invalid, tampered, or noncanonical LifePot replay");
  }
}
export function createReplay(input: { answers: SetupAnswers; config: LifeConfig; seed: number; requestHash: string; ledger: EpochLedger }): ReplayData {
  const body = contractBody({ version: 2, engineVersion: ENGINE_VERSION, answers: input.answers, config: lifeConfigSchema.parse(input.config), seed: input.seed, requestHash: input.requestHash, ledger: validateEpochLedger(input.ledger) });
  if (body.requestHash !== hashSetupRequest(body.answers)) throw new Error("Invalid request hash");
  return validateReplay({ ...body, contractHash: hashReplayPayload(body) });
}
function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text); let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
function fromBase64Url(text: string): string {
  const base64 = text.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}
export function encodeReplay(input: ReplayData): string { return toBase64Url(JSON.stringify(validateReplay(input))); }
export function decodeReplay(payload: string): ReplayData { try { return validateReplay(JSON.parse(fromBase64Url(payload))); } catch { throw new Error("Invalid or unsupported LifePot replay"); } }
export async function playReplay(input: ReplayData, _interpreter?: (...args: never[]) => unknown) {
  void _interpreter; const replay = validateReplay(input);
  const state = runWithDecisionLedger(createSimulation({ seed: replay.seed, config: replay.config }), replay.ledger, 180);
  return { replay, state, snapshot: snapshotSimulation(state) };
}
