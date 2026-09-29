import { describe, expect, it } from "vitest";
import { runFreshWithDecisions, runWithDecisionLedger } from "./runtime";
import { defaultConfig } from "./setup";
import { defaultRuleGraph } from "./rules";
import { PREY_STRATEGIES, MUTATION_TARGETS, MUTATION_TEMPOS, deterministicEvolutionDecision, summarizeEcology, validateEvolutionDecision } from "./decisions";
import { createSimulation, indexOf, stepSimulation, strategyName, snapshotSimulation, type OrganismSeed } from "./world";

const intent = { world: "two resource-feeding species", threat: "heat", reward: "different adaptations" };
function certain<T extends string>(choice: T, options: readonly T[]) {
  return { choice, confidence: 1, probabilities: Object.fromEntries(options.map(option => [option, option === choice ? 1 : 0])) };
}
function fixture() {
  const rules = defaultRuleGraph();
  rules.species = [{ id: "A", role: "grazer", selfInteraction: "neutral" }, { id: "B", role: "grazer", selfInteraction: "neutral" }];
  rules.interactions[0].mode = "neutral";
  const cell: OrganismSeed = { x: 10, y: 10, guild: "prey", ruleSpecies: 1, species: 1, energy: 220, lineage: 1, generation: 0, strategy: "efficient_grazing", traits: [128,128,128,128,128] };
  const initial = createSimulation({ seed: 6, config: { ...defaultConfig(), rules }, initialPopulation: [cell, { ...cell, x: 30, ruleSpecies: 2, species: 2, lineage: 2 }] });
  return { ...initial, generation: 30 };
}
function decision() {
  const fallback = deterministicEvolutionDecision(summarizeEcology(fixture(), intent, "stagnation"));
  return { ...fallback, speciesDirectives: [
    { species: "A", strategy: certain("armored", PREY_STRATEGIES), mutationTarget: certain("defense", MUTATION_TARGETS), mutationTempo: certain("slow", MUTATION_TEMPOS) },
    { species: "B", strategy: certain("swarming", PREY_STRATEGIES), mutationTarget: certain("metabolism", MUTATION_TARGETS), mutationTempo: certain("rapid", MUTATION_TEMPOS) },
  ] };
}

describe("species-scoped Jev germline directives", () => {
  it("validates and applies independent species choices only to the matching births", () => {
    const d = validateEvolutionDecision(decision());
    const next = stepSimulation(fixture(), d);
    expect(next.stats.births).toBe(2);
    expect(strategyName(next.strategy[indexOf(10, 10)], 1)).toBe("efficient_grazing");
    expect(strategyName(next.strategy[indexOf(30, 10)], 1)).toBe("efficient_grazing");
    for (let i = 0; i < next.guild.length; i++) if (next.guild[i] && next.organismGeneration[i] === 1) {
      expect(strategyName(next.strategy[i], next.guild[i])).toBe(next.ruleSpecies[i] === 1 ? "armored" : "swarming");
    }
    expect(snapshotSimulation(stepSimulation(fixture(), d))).toEqual(snapshotSimulation(next));
  });
  it("includes species-resolved population and energy in the frozen observation", () => {
    const summary = summarizeEcology(fixture(), intent, "stagnation");
    expect(summary.observation).toMatchObject({ species: [
      { species: "A", population: 1, meanEnergy: 220 },
      { species: "B", population: 1, meanEnergy: 220 },
    ] });
  });
  it("rejects unknown or incompatible species directives before executing a tick", () => {
    const unknown = decision();
    unknown.speciesDirectives[1].species = "D";
    expect(() => stepSimulation(fixture(), validateEvolutionDecision(unknown))).toThrow(/species/i);
    const incompatible = fixture();
    incompatible.config.rules!.species[1].role = "hunter";
    expect(() => stepSimulation(incompatible, validateEvolutionDecision(decision()))).toThrow(/species/i);
  });
  it("keeps offline fallback non-intervening instead of scripting ecological rescues", () => {
    const state = fixture();
    const fallback = deterministicEvolutionDecision(summarizeEcology(state, intent, "predator_crash"));
    expect(fallback.speciesDirectives).toEqual([]);
    expect(fallback.scheduledRuleChange).toBeUndefined();
    expect(snapshotSimulation(stepSimulation(state, fallback))).toEqual(snapshotSimulation(stepSimulation(state)));
  });
  it("rejects Jev decisions with omitted species authority", () => {
    const d = { ...decision(), source: "jev" as const, speciesDirectives: undefined };
    expect(() => stepSimulation(fixture(), validateEvolutionDecision(d))).toThrow(/species/i);
  });
  it("replays species directives exactly and rejects stale bindings", async () => {
    const initial = () => createSimulation({ seed: 6, config: fixture().config });
    const fresh = await runFreshWithDecisions(initial(), intent, async summary => ({
      ...deterministicEvolutionDecision(summary), source: "jev", speciesDirectives: decision().speciesDirectives,
    }), 60);
    expect(fresh.ledger.length).toBeGreaterThan(0);
    expect(fresh.ledger.every(item => item.source === "jev")).toBe(true);
    expect(snapshotSimulation(runWithDecisionLedger(initial(), fresh.ledger, 60, intent))).toEqual(snapshotSimulation(fresh.state));
    for (const field of ["generation", "observationHash", "ruleGraphVersion"] as const) {
      const stale = structuredClone(fresh.ledger);
      if (field === "observationHash") stale[0].observationHash = "eco_stale";
      else if (field === "generation") stale[0].generation += 1;
      else stale[0].ruleGraphVersion = 99;
      expect(() => runWithDecisionLedger(initial(), stale, 60, intent)).toThrow();
    }
    const omitted = structuredClone(fresh.ledger);
    delete omitted[0].speciesDirectives;
    expect(() => runWithDecisionLedger(initial(), omitted, 60, intent)).toThrow(/species/i);
  });
  it("rejects duplicate species directives", () => {
    const d = decision();
    d.speciesDirectives[1].species = "A";
    expect(() => validateEvolutionDecision(d)).toThrow(/species|decision/i);
  });
});
