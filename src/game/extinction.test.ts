import { describe, expect, it, vi } from "vitest";
import { deterministicEvolutionDecision } from "./decisions";
import { createReplay, decodeReplay, encodeReplay, playReplay } from "./replay";
import { advanceUntilDecisionTrigger, runFreshWithDecisions } from "./runtime";
import { defaultConfig, hashReplayPayload, hashSetupRequest } from "./setup";
import { createSimulation, DEFAULT_GENERATIONS, runSimulation, snapshotSimulation, stepSimulation, type LifeConfig, type OrganismSeed } from "./world";

const intent = { world: "two omnivore species", threat: "scarce food", reward: "survival" };

function consumerConfig(): LifeConfig {
  const config = defaultConfig();
  return {
    ...config,
    founders: { ...config.founders, balance: "balanced" },
    rules: {
      version: 1,
      species: [
        { id: "A", role: "omnivore", selfInteraction: "neutral" },
        { id: "B", role: "omnivore", selfInteraction: "neutral" },
      ],
      interactions: [{ pair: "A:B", mode: "neutral" }],
      environment: { regeneration: "steady", pressure: "stability", volatility: "stable", intensity: "low", duration: "persistent" },
    },
  };
}

const loneConsumer: OrganismSeed = {
  x: 10, y: 10, guild: "predator", ruleSpecies: 1, energy: 100,
  lineage: 1, species: 1, generation: 0, strategy: "ambush",
  traits: [128, 128, 128, 128, 128],
};

describe("extinction requires zero total living organisms", () => {
  it.each(["omnivore", "hunter"] as const)("keeps a %s-only founder world running beyond generation one", (role) => {
    const initial = role === "omnivore"
      ? createSimulation({ seed: 7, config: consumerConfig() })
      : createSimulation({ seed: 7, config: defaultConfig(), initialPopulation: [{ ...loneConsumer, ruleSpecies: 2 }] });
    expect(initial.stats.prey).toBe(0);
    expect(initial.stats.population).toBe(role === "omnivore" ? 20 : 1);
    const next = stepSimulation(initial);
    expect(next.stats.population).toBeGreaterThan(0);
    expect(next.outcome).toBe("running");
    expect(stepSimulation(next).generation).toBe(2);
  });

  it("continues after the last prey is eaten while its consumer remains alive", () => {
    const initial = createSimulation({
      seed: 7, config: defaultConfig(),
      initialPopulation: [
        { ...loneConsumer, ruleSpecies: 2, strategy: "pursuit" },
        { ...loneConsumer, x: 11, guild: "prey", ruleSpecies: 1, lineage: 2, species: 2, energy: 10, strategy: "efficient_grazing" },
      ],
    });
    expect(initial.stats.prey).toBe(1);
    const next = stepSimulation(initial);
    expect(next.stats.kills).toBe(1);
    expect(next.stats.prey).toBe(0);
    expect(next.stats.population).toBeGreaterThan(0);
    expect(next.outcome).toBe("running");
    expect(stepSimulation(next).generation).toBe(2);
  });

  it("advances the interactive runtime and bounded runner without basal organisms", () => {
    const initial = createSimulation({ seed: 7, config: consumerConfig() });
    const advanced = advanceUntilDecisionTrigger(initial, [], 3);
    expect(advanced.generation).toBe(3);
    expect(advanced.outcome).toBe("running");
    const completed = runSimulation(initial, 3);
    expect(completed.generation).toBe(3);
    expect(completed.stats.population).toBeGreaterThan(0);
    expect(completed.outcome).toBe("surviving");
  });

  it("marks an empty world extinct and stops after the last consumer dies", () => {
    const config = consumerConfig();
    const empty = createSimulation({ seed: 7, config, initialPopulation: [] });
    expect(empty.outcome).toBe("extinct");
    expect(stepSimulation(empty)).toBe(empty);
    const dying = createSimulation({ seed: 7, config: defaultConfig(), initialPopulation: [{ ...loneConsumer, ruleSpecies: 2, energy: 1 }] });
    const dead = stepSimulation(dying);
    expect(dead.stats.population).toBe(0);
    expect(dead.stats.deaths).toBe(1);
    expect(dead.outcome).toBe("extinct");
    expect(stepSimulation(dead)).toBe(dead);
  });

  it("classifies living consumers as surviving at the generation limit", () => {
    const initial = createSimulation({ seed: 7, config: consumerConfig(), initialPopulation: [loneConsumer] });
    const completed = stepSimulation({ ...initial, generation: DEFAULT_GENERATIONS - 1 });
    expect(completed.generation).toBe(DEFAULT_GENERATIONS);
    expect(completed.stats.population).toBe(1);
    expect(completed.outcome).toBe("surviving");
    expect(stepSimulation(completed)).toBe(completed);
  });

  it("replays the full consumer-only run exactly without model calls", async () => {
    const config = consumerConfig(), seed = 7;
    const fresh = await runFreshWithDecisions(createSimulation({ seed, config }), intent, async summary => deterministicEvolutionDecision(summary));
    expect(fresh.state.generation).toBeGreaterThan(1);
    expect(fresh.ledger.length).toBeGreaterThan(0);
    const replay = createReplay({ answers: intent, config, seed, requestHash: hashSetupRequest(intent), ledger: fresh.ledger });
    const model = vi.fn();
    const played = await playReplay(decodeReplay(encodeReplay(replay)), model);
    expect(played.snapshot).toEqual(snapshotSimulation(fresh.state));
    expect(model).not.toHaveBeenCalled();
    // Omnivores can now actually feed; replay must not force the old starvation bug.
    expect(fresh.state.outcome).toBe("surviving");
    expect(fresh.state.stats.population).toBeGreaterThan(0);
  });

  it.each(["lifepot-ca-3", "lifepot-ca-4"])("rejects incompatible %s replays instead of silently changing their outcome", async (engineVersion) => {
    const config = consumerConfig(), seed = 7;
    const fresh = await runFreshWithDecisions(createSimulation({ seed, config }), intent, async summary => deterministicEvolutionDecision(summary));
    const oldBody = {
      version: 3, engineVersion, answers: intent,
      config, seed, requestHash: hashSetupRequest(intent), ledger: fresh.ledger,
    };
    const encoded = btoa(JSON.stringify({ ...oldBody, contractHash: hashReplayPayload(oldBody) }));
    expect(() => decodeReplay(encoded)).toThrow(/unsupported/i);
  });
});
