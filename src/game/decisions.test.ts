import { describe, expect, it } from "vitest";
import { createSimulation, indexOf, type LifeConfig } from "./world";
import {
  CELL_ACTIONS,
  COHORT_IDS,
  DECISION_EPOCHS,
  ENVIRONMENT_ACTIONS,
  deterministicEpochDecision,
  summarizeEpochState,
  validateEpochDecision,
  type EpochDecision,
} from "./decisions";

const config: LifeConfig = {
  environment: { abundance: "balanced", distribution: "scattered", hazard: "crowding", volatility: "stable" },
  fitness: { survive: 0.2, replicate: 0.2, cooperate: 0.2, explore: 0.2, adapt: 0.2 },
};

const organism = (x: number, y: number, energy: number, traits: readonly [number, number, number, number, number]) => ({ x, y, energy, traits, lineage: x + y + 1, generation: 0 });

function answer<T extends string>(choice: T, options: readonly T[]) {
  return { choice, confidence: 1, probabilities: Object.fromEntries(options.map((option) => [option, option === choice ? 1 : 0])) as Record<T, number> };
}

describe("epoch decision contract", () => {
  it("freezes numeric world facts and groups every living cell into one meaningful fixed cohort", () => {
    const state = createSimulation({
      seed: 9,
      config,
      initialPopulation: [
        organism(2, 2, 18, [120, 120, 120, 120, 120]),
        organism(10, 10, 90, [230, 90, 80, 70, 60]),
        organism(20, 20, 90, [80, 90, 230, 70, 60]),
        organism(30, 30, 90, [80, 90, 70, 230, 60]),
        organism(40, 40, 90, [120, 120, 120, 120, 120]),
      ],
      initialResources: [{ x: 2, y: 2, amount: 3 }],
    });
    state.hazards[indexOf(2, 2)] = 77;

    const summary = summarizeEpochState(state, { world: "mineral pools", threat: "crowding", reward: "adapt" });

    expect(summary.generation).toBe(0);
    expect(summary.intent).toEqual({ world: "mineral pools", threat: "crowding", reward: "adapt" });
    expect(summary.world).toMatchObject({ population: 5, births: 0, deaths: 0 });
    expect(summary.world.meanResource).toBeTypeOf("number");
    expect(summary.world.meanHazard).toBeTypeOf("number");
    expect(summary.cohorts.map((cohort) => cohort.id)).toEqual(COHORT_IDS);
    expect(summary.cohorts.reduce((sum, cohort) => sum + cohort.count, 0)).toBe(5);
    expect(summary.cohorts.find((cohort) => cohort.id === "energy_stressed")?.count).toBe(1);
    expect(summary.cohorts.find((cohort) => cohort.id === "efficient_foragers")?.count).toBe(1);
    expect(summary.cohorts.find((cohort) => cohort.id === "explorers")?.count).toBe(1);
    expect(summary.cohorts.find((cohort) => cohort.id === "resilient")?.count).toBe(1);
    expect(Object.isFrozen(summary)).toBe(true);
    expect(Object.isFrozen(summary.cohorts)).toBe(true);
  });

  it("accepts only a complete finite action ledger with normalized probabilities and selected maxima", () => {
    const valid: EpochDecision = {
      generation: DECISION_EPOCHS[0],
      source: "jev",
      model: "jev-test",
      usage: { input_tokens: 22, output_tokens: 8 },
      cohorts: Object.fromEntries(COHORT_IDS.map((id) => [id, answer("conserve", CELL_ACTIONS)])) as EpochDecision["cohorts"],
      environment: answer("hold", ENVIRONMENT_ACTIONS),
    };
    expect(validateEpochDecision(valid)).toEqual(valid);
    const rounded = structuredClone(valid);
    rounded.environment.probabilities = { bloom: 0, redistribute: 0, hazard_surge: 0, relief: 0, hold: 0.99 };
    expect(validateEpochDecision(rounded).environment.choice).toBe("hold");
    expect(() => validateEpochDecision({ ...valid, cohorts: { ...valid.cohorts, explorers: { ...valid.cohorts.explorers, choice: "teleport" } } })).toThrow(/epoch decision/i);
    expect(() => validateEpochDecision({ ...valid, environment: { ...valid.environment, probabilities: { ...valid.environment.probabilities, hold: 0.8 } } })).toThrow(/epoch decision/i);
    expect(() => validateEpochDecision({ ...valid, environment: { ...valid.environment, choice: "bloom", probabilities: valid.environment.probabilities } })).toThrow(/epoch decision/i);
  });

  it("produces a deterministic bounded fallback for any frozen epoch", () => {
    const state = createSimulation({ seed: 9, config });
    const summary = summarizeEpochState(state, { world: "w", threat: "t", reward: "r" });
    const first = deterministicEpochDecision(summary);
    const second = deterministicEpochDecision(summary);
    expect(first).toEqual(second);
    expect(first.source).toBe("fallback");
    expect(CELL_ACTIONS).toContain(first.cohorts.energy_stressed.choice);
    expect(ENVIRONMENT_ACTIONS).toContain(first.environment.choice);
    expect(validateEpochDecision(first)).toEqual(first);
  });
});
