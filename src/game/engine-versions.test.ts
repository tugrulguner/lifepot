import { describe, expect, it } from "vitest";
import { detectEvolutionTrigger, deterministicEvolutionDecision } from "./decisions";
import { createReplay, decodeReplay, encodeReplay } from "./replay";
import { assertFixedHabitat } from "./fixed-habitat";
import { runFreshWithDecisions } from "./runtime";
import { defaultConfig, hashReplayPayload, hashSetupRequest } from "./setup";
import { interpretWorldPreview } from "./world-preview";
import {
  CA8_ENGINE_VERSION,
  ENGINE_VERSION,
  GRID_CELLS,
  LEGACY_ENGINE_VERSION,
  createSimulation,
  founderCount,
  indexOf,
  maxVariantLabel,
  phenotypeClass,
  snapshotSimulation,
  stepSimulation,
  type EngineVersion,
  type LifeConfig,
  type OrganismSeed,
  type SimulationState,
} from "./world";

const intent = { world: "pond", threat: "drought", reward: "observe" };
const grazer: OrganismSeed = {
  x: 10,
  y: 10,
  guild: "prey",
  ruleSpecies: 1,
  energy: 100,
  lineage: 1,
  species: 1,
  generation: 0,
  strategy: "early_brood",
  traits: [128, 128, 128, 128, 128],
};
function complete(state: SimulationState) {
  let current = state;
  while (current.outcome === "running") current = stepSimulation(current);
  return current;
}
/** Mean regrowth per cell per generation on a world whose resources are cleared before every step. */
function regrowth(mutate: (config: LifeConfig) => void, engineVersion: EngineVersion = ENGINE_VERSION) {
  const config = defaultConfig();
  mutate(config);
  let state = createSimulation({
    seed: 3,
    config,
    engineVersion,
    initialPopulation: [{ ...grazer, strategy: "armored", traits: [0, 0, 0, 0, 0], energy: 255 }],
  });
  let total = 0;
  for (let step = 0; step < 10; step++) {
    state.resources.fill(0);
    state = stepSimulation(state);
    total += state.stats.resources / GRID_CELLS;
  }
  return total / 10;
}

describe("recorded engine contracts stay bit-identical", () => {
  // Hashes were taken from the engine as committed before ca-9 existed. If one changes,
  // an old recording no longer reproduces: that needs a new contract, not a new hash.
  it.each([
    [LEGACY_ENGINE_VERSION, "replay_9cripq", 1707, 83, 350056998],
    [CA8_ENGINE_VERSION, "replay_nuv3ky", 780, 236, 2021806361],
  ] as const)("%s reproduces its recorded full run", (engineVersion, hash, prey, predators, rngState) => {
    const final = complete(createSimulation({ seed: 7, config: defaultConfig(), engineVersion }));
    expect([final.generation, final.stats.prey, final.stats.predators, final.rngState]).toEqual([
      180,
      prey,
      predators,
      rngState,
    ]);
    expect(hashReplayPayload(snapshotSimulation(final))).toBe(hash);
  });

  it("is deterministic under ca-9 and labels new runs with it", () => {
    const run = () => snapshotSimulation(complete(createSimulation({ seed: 7, config: defaultConfig() })));
    expect(ENGINE_VERSION).toBe("lifepot-ca-9");
    expect(run()).toEqual(run());
    expect(run().engineVersion).toBe(ENGINE_VERSION);
  });

  it("accepts ca-8 and ca-9 replays and keeps each on its own contract", async () => {
    for (const engineVersion of [CA8_ENGINE_VERSION, ENGINE_VERSION] as const) {
      const config = defaultConfig();
      const { ledger } = await runFreshWithDecisions(
        createSimulation({ seed: 11, config, engineVersion }),
        intent,
        async (summary) => deterministicEvolutionDecision(summary),
      );
      const replay = createReplay({
        answers: intent,
        config,
        seed: 11,
        requestHash: hashSetupRequest(intent),
        ledger,
        engineVersion,
      });
      expect(decodeReplay(encodeReplay(replay)).engineVersion).toBe(engineVersion);
    }
  });
});

describe("worlds saved under ca-8 keep their habitat features", () => {
  it("runs a ca-8 fixed habitat under ca-8 and still refuses ca-7", () => {
    const fixedHabitat = { version: 1 as const, observationLimit: 200 };
    const saved = createSimulation({ seed: 4, config: defaultConfig(), engineVersion: CA8_ENGINE_VERSION, fixedHabitat });
    expect(() => assertFixedHabitat(saved)).not.toThrow();
    const next = stepSimulation(saved);
    expect([next.generation, next.engineVersion]).toEqual([1, CA8_ENGINE_VERSION]);
    // The ca-8 world keeps ca-8 founders and variant labels rather than adopting ca-9 mechanics.
    expect([saved.stats.prey, saved.stats.predators]).toEqual([18, 8]);
    expect(Math.max(...saved.species)).toBeLessThanOrEqual(maxVariantLabel(CA8_ENGINE_VERSION));
    expect(() =>
      createSimulation({ seed: 4, config: defaultConfig(), engineVersion: LEGACY_ENGINE_VERSION, fixedHabitat }),
    ).toThrow(/ca8 engine or later/);
  });
});

describe("ca-9 resource regrowth follows the computed rate", () => {
  const drought = (intensity: "low" | "medium" | "high") => (config: LifeConfig) => {
    config.rules!.environment = { ...config.rules!.environment, pressure: "drought", intensity };
  };

  it("keeps the unmodified stable baseline at the earlier whole-unit rates", () => {
    expect(regrowth(() => {})).toBeCloseTo(2, 1);
    expect(regrowth((config) => void (config.environment.abundance = "scarce"))).toBeCloseTo(1, 1);
    expect(regrowth((config) => void (config.environment.abundance = "rich"))).toBeCloseTo(3, 1);
  });

  it("distinguishes drought intensities that rounding used to merge", () => {
    const [low, medium, high] = [regrowth(drought("low")), regrowth(drought("medium")), regrowth(drought("high"))];
    expect(low).toBeGreaterThan(medium + 0.2);
    expect(medium).toBeGreaterThan(high + 0.2);
    // ca-8 rounded all three to the same single unit.
    expect(new Set((["low", "medium", "high"] as const).map((level) => regrowth(drought(level), CA8_ENGINE_VERSION))).size).toBe(1);
  });

  it("no longer rounds a scarce drought down to zero regrowth", () => {
    const scarceDrought = (config: LifeConfig) => {
      config.environment.abundance = "scarce";
      drought("medium")(config);
    };
    expect(regrowth(scarceDrought, CA8_ENGINE_VERSION)).toBe(0);
    expect(regrowth(scarceDrought)).toBeGreaterThan(0.4);
  });
});

describe("ca-9 variants are phenotype classes", () => {
  it("keeps founders in one class per rule species and separates drifted traits", () => {
    const traits = new Uint8Array([128, 128, 128, 128, 128, 158, 98, 143, 128, 128, 164, 128, 128, 128, 128]);
    expect(phenotypeClass(traits, 1, 1)).toBe(phenotypeClass(traits, 0, 1));
    expect(phenotypeClass(traits, 2, 1)).not.toBe(phenotypeClass(traits, 0, 1));
    expect(phenotypeClass(traits, 0, 2)).not.toBe(phenotypeClass(traits, 0, 1));
  });

  it("starts a varied world with one living variant per seeded species", () => {
    const state = createSimulation({ seed: 5, config: defaultConfig() });
    expect(state.stats.speciesRichness).toBe(state.config.rules!.species.length);
  });
});

describe("ca-9 traits carry a cost", () => {
  const lone = (metabolism: number, mobility: number, engineVersion: EngineVersion) => {
    const state = createSimulation({
      seed: 1,
      config: defaultConfig(),
      engineVersion,
      initialPopulation: [{ ...grazer, energy: 80, traits: [metabolism, 128, mobility, 128, 128] }],
      initialResources: [{ x: 10, y: 10, amount: 0 }],
    });
    state.resources.fill(0);
    // Mobility 0 keeps the organism in place so only upkeep differs.
    return stepSimulation(state).energy[indexOf(10, 10)];
  };

  it("charges more upkeep for a higher metabolism only under ca-9", () => {
    expect(lone(228, 0, ENGINE_VERSION)).toBeLessThan(lone(28, 0, ENGINE_VERSION));
    expect(lone(228, 0, CA8_ENGINE_VERSION)).toBeCloseTo(lone(28, 0, CA8_ENGINE_VERSION), 5);
  });
});

describe("ca-9 founders and triggers", () => {
  it("seeds a wider basal base under fewer hunters", () => {
    expect([founderCount("grazer", "balanced"), founderCount("hunter", "balanced")]).toEqual([24, 6]);
    expect([
      founderCount("grazer", "balanced", CA8_ENGINE_VERSION),
      founderCount("hunter", "balanced", CA8_ENGINE_VERSION),
    ]).toEqual([18, 8]);
    const state = createSimulation({ seed: 9, config: defaultConfig() });
    expect([state.stats.prey, state.stats.predators]).toEqual([24, 6]);
    const preview = interpretWorldPreview(defaultConfig(), intent);
    expect(preview.species.map((item) => item.count)).toEqual([24, 6]);
  });

  it("does not report the founding regrowth ramp as a resource shift", () => {
    const at12 = (engineVersion: EngineVersion) => {
      const config = defaultConfig();
      // No hunters, so the only change in the first twelve generations is regrowth and grazing.
      let state = createSimulation({ seed: 1, config, engineVersion, initialPopulation: [grazer] });
      while (state.generation < 12) state = stepSimulation(state);
      return detectEvolutionTrigger(state, []);
    };
    expect(at12(CA8_ENGINE_VERSION)).toBe("resource_shift");
    expect(at12(ENGINE_VERSION)).toBeNull();
  });

  it("does not call early predation a spike before a full baseline window exists", () => {
    for (const seed of [1, 2, 3, 4]) {
      let state = createSimulation({ seed, config: defaultConfig() });
      const early: Array<string | null> = [];
      while (state.generation < 23 && state.outcome === "running") {
        state = stepSimulation(state);
        early.push(detectEvolutionTrigger(state, []));
      }
      expect(early).not.toContain("predation_spike");
      // The default world does hunt in this period, so the absence above is the baseline rule at work.
      expect(state.stats.kills).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("setup preview names roles without an energy source", () => {
  it("warns about a scavenger that has no feeding link", () => {
    const config = defaultConfig();
    config.rules!.species[1] = { id: "B", role: "scavenger", selfInteraction: "neutral" };
    config.rules!.interactions[0].mode = "neutral";
    expect(interpretWorldPreview(config, intent).warnings.join(" ")).toMatch(/B \(scavenger\) has no modeled food source/);
    config.rules!.interactions[0].mode = "b_consumes_a";
    expect(interpretWorldPreview(config, intent).warnings.join(" ")).not.toMatch(/scavenger/);
  });

  it("does not say a hunter that feeds on its own kind will starve", () => {
    const config = defaultConfig();
    config.rules!.interactions[0].mode = "neutral";
    config.rules!.species[1] = { id: "B", role: "hunter", selfInteraction: "neutral" };
    expect(interpretWorldPreview(config, intent).warnings.join(" ")).toMatch(/expected to starve/);
    config.rules!.species[1] = { id: "B", role: "hunter", selfInteraction: "cannibalistic" };
    const warnings = interpretWorldPreview(config, intent).warnings.join(" ");
    expect(warnings).toMatch(/B \(hunter\) has no modeled consumption link/);
    expect(warnings).not.toMatch(/expected to starve/);
  });
});
