import { describe, expect, it, vi } from "vitest";
import { defaultConfig, hashSetupRequest, type SetupAnswers } from "./setup";
import { createReplay, decodeReplay, encodeReplay, playReplay } from "./replay";
import { CELL_ACTIONS, COHORT_IDS, DECISION_EPOCHS, ENVIRONMENT_ACTIONS, type EpochDecision } from "./decisions";

const answers: SetupAnswers = {
  world: "Sunlight and mineral pools are scattered across the world.",
  threat: "Heat arrives in unpredictable waves.",
  reward: "Reward reproduction and adaptation.",
};

function validReplay() {
  const certain = <T extends string>(choice: T, options: readonly T[]) => ({ choice, confidence: 1, probabilities: Object.fromEntries(options.map((option) => [option, option === choice ? 1 : 0])) as Record<T, number> });
  const ledger = DECISION_EPOCHS.map((generation): EpochDecision => ({
    generation, source: "fallback",
    cohorts: Object.fromEntries(COHORT_IDS.map((id) => [id, certain("conserve", CELL_ACTIONS)])) as EpochDecision["cohorts"],
    environment: certain("hold", ENVIRONMENT_ACTIONS),
  }));
  return createReplay({ answers, config: defaultConfig(), seed: 2026, requestHash: hashSetupRequest(answers), ledger });
}

describe("deterministic replay contract", () => {
  it("roundtrips exact inputs, interpreted config, seed, engine version, and the full decision ledger", () => {
    const replay = validReplay();
    const encoded = encodeReplay(replay);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeReplay(encoded)).toEqual(replay);
    expect(replay.ledger.map((decision) => decision.generation)).toEqual(DECISION_EPOCHS);
  });

  it("rejects a canonical ledger prefix while the population can reach a later epoch", () => {
    const replay = validReplay();
    expect(() => createReplay({ ...replay, ledger: replay.ledger.slice(0, 2) })).toThrow(/incomplete|missing|replay/i);
  });

  it("accepts a canonical ledger prefix when extinction makes later epochs unreachable", () => {
    const replay = validReplay();
    const harshConfig = {
      environment: { abundance: "scarce", distribution: "clustered", hazard: "heat", volatility: "chaotic" },
      fitness: { survive: 0, replicate: 1, cooperate: 0, explore: 0, adapt: 0 },
    } as const;
    const certain = <T extends string>(choice: T, options: readonly T[]) => ({ choice, confidence: 1, probabilities: Object.fromEntries(options.map((option) => [option, option === choice ? 1 : 0])) as Record<T, number> });
    const hostile: EpochDecision = {
      generation: 0,
      source: "fallback",
      cohorts: Object.fromEntries(COHORT_IDS.map((id) => [id, certain("reproduce", CELL_ACTIONS)])) as EpochDecision["cohorts"],
      environment: certain("hazard_surge", ENVIRONMENT_ACTIONS),
    };
    const extinct = createReplay({ ...replay, config: harshConfig, seed: 259, ledger: [hostile] });
    expect(decodeReplay(encodeReplay(extinct)).ledger.map((decision) => decision.generation)).toEqual([0]);
  });

  it("replays the exact simulation and makes zero interpretation calls", async () => {
    const replay = validReplay();
    const interpreter = vi.fn(() => Promise.reject(new Error("must not run")));
    const first = await playReplay(replay, interpreter);
    const second = await playReplay(replay, interpreter);
    expect(interpreter).not.toHaveBeenCalled();
    expect(first.snapshot).toEqual(second.snapshot);
    expect(first.state.stats).toEqual(second.state.stats);
  });

  it("rejects tampered inputs, config, request hashes, and noncanonical fitness", async () => {
    const replay = validReplay();
    await expect(playReplay({ ...replay, seed: replay.seed + 1 })).rejects.toThrow(/invalid|tamper/i);
    await expect(playReplay({ ...replay, requestHash: "wrong" })).rejects.toThrow(/invalid|tamper/i);
    await expect(playReplay({ ...replay, config: { ...replay.config, environment: { ...replay.config.environment, hazard: "toxin" } } })).rejects.toThrow(/invalid|tamper/i);
    await expect(playReplay({ ...replay, config: { ...replay.config, fitness: { ...replay.config.fitness, survive: 0.9 } } })).rejects.toThrow(/invalid|canonical/i);
    await expect(playReplay({ ...replay, ledger: replay.ledger.slice(1) })).rejects.toThrow(/invalid|tamper|missing/i);
  });
});
