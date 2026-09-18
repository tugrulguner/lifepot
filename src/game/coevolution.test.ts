import { describe, expect, it } from "vitest";
import {
  MAX_ENERGY,
  MAX_SPECIES,
  createSimulation,
  indexOf,
  snapshotSimulation,
  strategyName,
  stepSimulation,
  type LifeConfig,
} from "./world";
import {
  ENVIRONMENT_PRESSURES,
  MUTATION_TARGETS,
  PREDATOR_STRATEGIES,
  PREY_STRATEGIES,
  deterministicEvolutionDecision,
  detectEvolutionTrigger,
  observationHash,
  summarizeEcology,
  validateEvolutionDecision,
} from "./decisions";
import { runFreshWithDecisions, runWithDecisionLedger } from "./runtime";
import type { SetupAnswers } from "./setup";

const intent: SetupAnswers = {
  world: "rich nutrients scattered across a broad plain",
  threat: "predators and drought arrive in waves",
  reward: "prey and predators should diversify and coexist",
};
const config: LifeConfig = {
  environment: { abundance: "rich", distribution: "scattered", hazard: "drought", volatility: "pulsing" },
  fitness: { survive: .2, replicate: .2, cooperate: .2, explore: .2, adapt: .2 },
  founders: { balance: "balanced", diversity: "varied", preyStrategy: "efficient_grazing", predatorStrategy: "pursuit" },
};

function run(state = createSimulation({ seed: 412, config }), generations = 80) {
  let current = state;
  for (let i = 0; i < generations && current.outcome === "running"; i += 1) current = stepSimulation(current);
  return current;
}

describe("prey, predator, and environment co-evolution", () => {
  it("seeds living prey and predator guilds with inherited strategies and bounded energy", () => {
    const state = createSimulation({ seed: 1, config });
    expect(state.stats.prey).toBeGreaterThan(0);
    expect(state.stats.predators).toBeGreaterThan(0);
    expect(Array.from(state.guild).filter((guild) => guild === 1)).toHaveLength(state.stats.prey);
    expect(Array.from(state.guild).filter((guild) => guild === 2)).toHaveLength(state.stats.predators);
    expect(state.energy.every((energy) => energy >= 0 && energy <= MAX_ENERGY)).toBe(true);
    const preyIndex = state.guild.findIndex((guild) => guild === 1);
    expect(PREY_STRATEGIES).toContain(strategyName(state.strategy[preyIndex], 1) as never);
  });

  it("moves predators, consumes each prey at most once, gains bounded energy, and records kills", () => {
    const state = createSimulation({
      seed: 9,
      config,
      initialPopulation: [
        { x: 10, y: 10, guild: "prey", energy: 80, lineage: 1, species: 1, generation: 0, strategy: "armored", traits: [128,128,128,128,128] },
        { x: 9, y: 10, guild: "predator", energy: 80, lineage: 2, species: 2, generation: 0, strategy: "pursuit", traits: [128,128,128,128,128] },
        { x: 11, y: 10, guild: "predator", energy: 80, lineage: 3, species: 3, generation: 0, strategy: "pack_hunting", traits: [128,128,128,128,128] },
      ],
    });
    const next = stepSimulation(state);
    expect(next.stats.kills).toBeLessThanOrEqual(1);
    expect(next.stats.prey).toBe(0);
    expect(next.stats.predators).toBeGreaterThan(0);
    expect(Math.max(...next.energy)).toBeLessThanOrEqual(MAX_ENERGY);
    expect(next.guild[indexOf(10, 10)]).toBe(2);
  });

  it("inherits guild, genome, lineage, species, and strategy while bounding mutations and species", () => {
    const evolved = run(undefined, 180);
    expect(evolved.stats.births).toBeGreaterThan(0);
    expect(evolved.stats.speciesRichness).toBeLessThanOrEqual(MAX_SPECIES);
    expect(evolved.traits.every((trait) => trait >= 0 && trait <= 255)).toBe(true);
    for (let i = 0; i < evolved.guild.length; i += 1) {
      if (!evolved.guild[i]) continue;
      expect(evolved.lineage[i]).toBeGreaterThan(0);
      expect(evolved.species[i]).toBeGreaterThan(0);
      expect(evolved.strategy[i]).toBeGreaterThanOrEqual(0);
    }
  });

  it("produces divergent outcomes from different heritable guild strategies", () => {
    const ambush = run(createSimulation({ seed: 88, config: { ...config, founders: { ...config.founders, predatorStrategy: "ambush" } } }), 90);
    const pursuit = run(createSimulation({ seed: 88, config: { ...config, founders: { ...config.founders, predatorStrategy: "pursuit" } } }), 90);
    expect(snapshotSimulation(ambush)).not.toEqual(snapshotSimulation(pursuit));
    expect([ambush.stats.kills, ambush.stats.predators]).not.toEqual([pursuit.stats.kills, pursuit.stats.predators]);
  });

  it("detects predator extinction and lets a Jev-directed predatory lineage re-emerge through birth", () => {
    const initial = createSimulation({
      seed: 101,
      config,
      initialPopulation: [
        { x: 10, y: 10, guild: "prey", energy: 240, lineage: 1, species: 1, generation: 3, strategy: "early_brood", traits: [180, 180, 128, 128, 128] },
      ],
      initialResources: [{ x: 10, y: 10, amount: 255 }],
    });
    const collapsed = {
      ...initial,
      generation: 12,
      history: [{ generation: 0, prey: 1, predators: 2, kills: 0, resources: initial.stats.resources, speciesRichness: 3 }],
    };
    expect(detectEvolutionTrigger(collapsed, [])).toBe("predator_crash");
    const decision = deterministicEvolutionDecision(summarizeEcology(collapsed, intent, "predator_crash"));
    const next = stepSimulation(collapsed, decision);
    expect(next.stats.predators).toBe(1);
    expect(next.stats.prey).toBeGreaterThan(0);
  });
});

describe("event-driven bounded evolution decisions", () => {
  it("does not trigger before generation 12, enforces a 12-generation cooldown, and caps decisions at eight", () => {
    const initial = createSimulation({ seed: 22, config });
    expect(detectEvolutionTrigger(initial, [])).toBeNull();
    const state12 = run(initial, 12);
    const first = detectEvolutionTrigger(state12, []);
    if (first) {
      const summary = summarizeEcology(state12, intent, first);
      const decision = deterministicEvolutionDecision(summary);
      expect(detectEvolutionTrigger(state12, [decision])).toBeNull();
      expect(detectEvolutionTrigger(run(state12, 11), [decision])).toBeNull();
      expect(detectEvolutionTrigger(run(state12, 12), Array(8).fill(decision))).toBeNull();
    }
  });

  it("freezes canonical observations and strictly validates all eight independent bounded Choices", () => {
    const state = run(undefined, 30);
    const trigger = detectEvolutionTrigger(state, []) ?? "stagnation";
    const summary = summarizeEcology(state, intent, trigger);
    expect(Object.isFrozen(summary)).toBe(true);
    const decision = deterministicEvolutionDecision(summary);
    expect(decision.observationHash).toBe(observationHash(summary.observation));
    expect(PREY_STRATEGIES).toContain(decision.preyStrategy.choice);
    expect(PREDATOR_STRATEGIES).toContain(decision.predatorStrategy.choice);
    expect(MUTATION_TARGETS).toContain(decision.preyMutationTarget.choice);
    expect(ENVIRONMENT_PRESSURES).toContain(decision.environmentPressure.choice);
    expect(validateEvolutionDecision(decision)).toEqual(decision);
    expect(() => validateEvolutionDecision({ ...decision, environmentIntensity: { ...decision.environmentIntensity, choice: "high", probabilities: { low: .8, medium: .1, high: .1 } } })).toThrow(/decision/i);
  });

  it("pauses at exact triggers, records fallback provenance, and replays the same seed plus ledger exactly", async () => {
    const decide = async () => { throw new Error("offline"); };
    const fresh = await runFreshWithDecisions(createSimulation({ seed: 930, config }), intent, decide);
    expect(fresh.ledger.length).toBeLessThanOrEqual(8);
    expect(fresh.ledger.every((decision) => decision.source === "fallback")).toBe(true);
    const replay = runWithDecisionLedger(createSimulation({ seed: 930, config }), fresh.ledger);
    expect(snapshotSimulation(replay)).toEqual(snapshotSimulation(fresh.state));
    if (fresh.ledger.length) expect(() => runWithDecisionLedger(createSimulation({ seed: 930, config }), fresh.ledger.slice(1))).toThrow(/missing|order|observation/i);
  });
});
