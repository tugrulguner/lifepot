import { describe, expect, it } from "vitest";
import { defaultConfig } from "./setup";
import { deterministicEvolutionDecision, type EcologySummary } from "./decisions";
import { createSimulation, snapshotSimulation, stepSimulation, type LifeConfig, type OrganismSeed, type SimulationState } from "./world";
import type { PairInteraction, SelfInteraction, WorldRuleGraph } from "./rules";

function graph(pairMode: PairInteraction, selfB: SelfInteraction = "territorial"): WorldRuleGraph {
  return {
    version: 1,
    species: [
      { id: "A", role: "grazer", selfInteraction: "cooperative" },
      { id: "B", role: "hunter", selfInteraction: selfB },
      { id: "C", role: "hunter", selfInteraction: "territorial" },
    ],
    interactions: [
      { pair: "A:B", mode: "b_consumes_a" },
      { pair: "A:C", mode: "b_consumes_a" },
      { pair: "B:C", mode: pairMode },
    ],
    environment: { regeneration: "steady", pressure: "stability", volatility: "stable", intensity: "low", duration: "persistent" },
  };
}

function config(rules: WorldRuleGraph): LifeConfig {
  return { ...defaultConfig(), rules };
}

function organism(x: number, y: number, ruleSpecies: 1 | 2 | 3, lineage: number): OrganismSeed {
  const hunter = ruleSpecies !== 1;
  return {
    x, y, ruleSpecies, guild: hunter ? "predator" : "prey", energy: 100,
    lineage, species: ruleSpecies, generation: 0,
    strategy: hunter ? "pursuit" : "efficient_grazing",
    traits: [128, 128, 128, 128, 128],
  };
}

describe("Jev-built rule graph execution", () => {
  it("lets one hunter species consume another when Jev defines that directional rule", () => {
    const state = createSimulation({ seed: 4, config: config(graph("a_consumes_b")), initialPopulation: [organism(10, 10, 2, 1), organism(11, 10, 3, 2)] });
    const next = stepSimulation(state);
    expect(next.stats.kills).toBe(1);
    expect(Array.from(next.ruleSpecies).filter((slot) => slot === 3)).toHaveLength(0);
    expect(Array.from(next.ruleSpecies).filter((slot) => slot === 2)).toHaveLength(1);
  });

  it("allows same-species consumption only when Jev selects cannibalism", () => {
    const founders = [organism(10, 10, 2, 1), organism(11, 10, 2, 2)];
    const cannibal = stepSimulation(createSimulation({ seed: 7, config: config(graph("competition", "cannibalistic")), initialPopulation: founders }));
    const cooperative = stepSimulation(createSimulation({ seed: 7, config: config(graph("competition", "cooperative")), initialPopulation: founders }));
    expect(cannibal.stats.population).toBeLessThan(cooperative.stats.population);
    expect(cannibal.stats.kills).toBeGreaterThan(cooperative.stats.kills);
  });

  it("resolves two consumers targeting one organism without deleting or double-counting", () => {
    const hunters = [organism(10, 10, 2, 1), organism(12, 10, 2, 2)];
    const prey = organism(11, 10, 1, 3);
    const next = stepSimulation(createSimulation({ seed: 9, config: config(graph("competition")), initialPopulation: [...hunters, prey] }));
    expect(next.stats.kills).toBe(1);
    expect(next.stats.deaths).toBe(1);
    expect(next.stats.population).toBe(2);
    expect(Array.from(next.ruleSpecies).filter((slot) => slot === 2)).toHaveLength(2);
  });

  it("does not count a kill when the intended consumer target already moved", () => {
    const next = stepSimulation(createSimulation({ seed: 5, config: config(graph("b_consumes_a")), initialPopulation: [organism(9, 10, 1, 1), organism(10, 10, 2, 2), organism(11, 10, 3, 3)] }));
    expect(next.stats.kills).toBe(1);
    expect(next.stats.deaths).toBe(1);
    expect(next.stats.population).toBe(2);
  });

  it("makes founder balance and fitness priorities mechanically observable", () => {
    const preyHeavy = { ...config(graph("neutral")), founders: { ...defaultConfig().founders, balance: "prey_heavy" as const } };
    const predatorHeavy = { ...config(graph("neutral")), founders: { ...defaultConfig().founders, balance: "predator_heavy" as const } };
    expect(createSimulation({ seed: 15, config: preyHeavy }).stats.prey).toBeGreaterThan(createSimulation({ seed: 15, config: predatorHeavy }).stats.prey);
    expect(createSimulation({ seed: 15, config: predatorHeavy }).stats.predators).toBeGreaterThan(createSimulation({ seed: 15, config: preyHeavy }).stats.predators);
    const survival = { ...config(graph("mutualism")), fitness: { survive: .8, replicate: .05, cooperate: .05, explore: .05, adapt: .05 } };
    const replication = { ...config(graph("mutualism")), fitness: { survive: .05, replicate: .8, cooperate: .05, explore: .05, adapt: .05 } };
    let a = createSimulation({ seed: 21, config: survival }), b = createSimulation({ seed: 21, config: replication });
    for (let generation = 0; generation < 12; generation += 1) { a = stepSimulation(a); b = stepSimulation(b); }
    expect(snapshotSimulation(a)).not.toEqual(snapshotSimulation(b));
  });

  it("produces distinct deterministic outcomes for competition, mutualism, and avoidance", () => {
    const founders = [organism(10, 10, 2, 1), organism(11, 10, 3, 2), organism(12, 10, 1, 3)];
    const outcomes = (["competition", "mutualism", "avoidance"] as const).map((mode) => snapshotSimulation(stepSimulation(createSimulation({ seed: 12, config: config(graph(mode)), initialPopulation: founders }))));
    expect(outcomes[0]).not.toEqual(outcomes[1]);
    expect(outcomes[1]).not.toEqual(outcomes[2]);
    const repeated = snapshotSimulation(stepSimulation(createSimulation({ seed: 12, config: config(graph("competition")), initialPopulation: founders })));
    expect(repeated).toEqual(outcomes[0]);
  });

  it("applies and deterministically reverts a bounded timed environment patch", () => {
    let state: SimulationState = { ...createSimulation({ seed: 3, config: config(graph("neutral")) }), generation: 12 };
    const summary: EcologySummary = {
      generation: 12, trigger: "stagnation",
      intent: { world: "test", threat: "test", reward: "test" },
      environment: state.config.environment, objective: state.config.fitness, rules: state.config.rules,
      observation: { generation: 12, prey: state.stats.prey, predators: state.stats.predators, preyDelta12: 0, predatorDelta12: 0, kills12: 0, resourceMean: 50, resourceDelta12: 0, speciesRichness: 3, speciesDelta12: 0, meanPreyEnergy: 100, meanPredatorEnergy: 100 },
    };
    const fallback = deterministicEvolutionDecision(summary);
    const decision = { ...fallback, ruleGraphVersion: 1, scheduledRuleChange: { decidedAtGeneration: 12, activation: "immediate" as const, duration: "short" as const, transition: "abrupt" as const, patch: { kind: "environment" as const, field: "pressure" as const, value: "drought" as const } } };
    state = stepSimulation(state, decision);
    expect(state.config.rules?.version).toBe(2);
    expect(state.config.rules?.environment.pressure).toBe("drought");
    expect(state.config.rules?.environment.intensity).toBe("medium");
    for (let generation = 0; generation < 6; generation += 1) state = stepSimulation(state, decision);
    expect(state.config.rules?.version).toBe(3);
    expect(state.config.rules?.environment.pressure).toBe("stability");
  });
});
