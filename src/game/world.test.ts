import { describe, expect, it } from "vitest";
import {
  ENGINE_VERSION,
  GRID_CELLS,
  GRID_SIZE,
  createSimulation,
  indexOf,
  runSimulation,
  snapshotSimulation,
  stepSimulation,
  type LifeConfig,
} from "./world";

const balanced: LifeConfig = {
  environment: { abundance: "balanced", distribution: "scattered", hazard: "drought", volatility: "stable" },
  fitness: { survive: 0.2, replicate: 0.2, cooperate: 0.2, explore: 0.2, adapt: 0.2 },
};

function organism(x: number, y: number, energy = 120) {
  return { x, y, energy, traits: [128, 128, 128, 128, 128] as const, lineage: 1, generation: 0 };
}

describe("deterministic 50x50 cellular life engine", () => {
  it("uses typed arrays for a 50x50 toroidal population grid", () => {
    const state = createSimulation({ seed: 7, config: balanced, initialPopulation: [organism(0, 0)] });
    expect(ENGINE_VERSION).toMatch(/^lifepot-/);
    expect(GRID_SIZE).toBe(50);
    expect(GRID_CELLS).toBe(2500);
    expect(state.occupied).toBeInstanceOf(Uint8Array);
    expect(state.energy).toBeInstanceOf(Float32Array);
    expect(state.age).toBeInstanceOf(Uint16Array);
    expect(state.lineage).toBeInstanceOf(Uint32Array);
    expect(state.traits).toBeInstanceOf(Uint8Array);
    expect(indexOf(-1, 0)).toBe(indexOf(49, 0));
    expect(indexOf(50, 50)).toBe(indexOf(0, 0));
  });

  it("consumes local resources, regrows them, and replicates into adjacent empty space", () => {
    const state = createSimulation({
      seed: 11,
      config: { ...balanced, environment: { ...balanced.environment, abundance: "rich" }, fitness: { survive: 0.05, replicate: 0.75, cooperate: 0.05, explore: 0.05, adapt: 0.1 } },
      initialPopulation: [organism(25, 25, 220)],
      initialResources: [{ x: 25, y: 25, amount: 220 }, { x: 0, y: 0, amount: 0 }],
    });
    const beforeResource = state.resources[indexOf(25, 25)];
    const next = stepSimulation(state);
    expect(next.resources[indexOf(25, 25)]).toBeLessThan(beforeResource);
    expect(next.stats.births).toBeGreaterThan(0);
    expect(next.stats.population).toBe(2);

    let regrown = next;
    for (let i = 0; i < 10; i += 1) regrown = stepSimulation(regrown);
    expect(regrown.resources[indexOf(0, 0)]).toBeGreaterThan(0);
  });

  it("kills organisms that cannot pay metabolism", () => {
    const state = createSimulation({
      seed: 2,
      config: { ...balanced, environment: { abundance: "scarce", distribution: "scattered", hazard: "drought", volatility: "stable" } },
      initialPopulation: [organism(4, 4, 1)],
      initialResources: [{ x: 4, y: 4, amount: 0 }],
    });
    const next = stepSimulation(state);
    expect(next.stats.population).toBe(0);
    expect(next.stats.deaths).toBe(1);
    expect(next.outcome).toBe("extinct");
  });

  it.each(["drought", "toxin", "heat", "crowding", "predator"] as const)("applies the %s hazard mechanically", (hazard) => {
    const config: LifeConfig = { ...balanced, environment: { abundance: "scarce", distribution: "scattered", hazard, volatility: "pulsing" } };
    const state = createSimulation({ seed: 19, config, initialPopulation: [organism(8, 8, 80)], initialResources: [{ x: 8, y: 8, amount: 80 }] });
    const baseline = createSimulation({ seed: 19, config: balanced, initialPopulation: [organism(8, 8, 80)], initialResources: [{ x: 8, y: 8, amount: 80 }] });
    const hazardous = stepSimulation(state);
    const safe = stepSimulation(baseline);
    expect(hazardous.hazards.some((value) => value > 0)).toBe(true);
    expect(hazardous.energy[indexOf(8, 8)]).not.toBe(safe.energy[indexOf(8, 8)]);
  });

  it("makes predators local and punishes isolated cells more than grouped cells", () => {
    const config: LifeConfig = {
      ...balanced,
      environment: { abundance: "balanced", distribution: "scattered", hazard: "predator", volatility: "pulsing" },
      fitness: { survive: 0.1, replicate: 0.1, cooperate: 0.6, explore: 0.1, adapt: 0.1 },
    };
    const isolated = createSimulation({ seed: 23, config, initialPopulation: [organism(26, 13, 90)] });
    const grouped = createSimulation({ seed: 23, config, initialPopulation: [organism(26, 13, 90), organism(26, 14, 90), organism(27, 13, 90)] });
    expect(stepSimulation(isolated).energy[indexOf(26, 13)]).toBeLessThan(stepSimulation(grouped).energy[indexOf(26, 13)]);
  });

  it("fitness priorities produce different population dynamics on the same seed and world", () => {
    const replicate: LifeConfig = { ...balanced, fitness: { survive: 0.05, replicate: 0.8, cooperate: 0.05, explore: 0.05, adapt: 0.05 } };
    const survive: LifeConfig = { ...balanced, fitness: { survive: 0.8, replicate: 0.05, cooperate: 0.05, explore: 0.05, adapt: 0.05 } };
    const a = runSimulation(createSimulation({ seed: 987, config: replicate }), 80);
    const b = runSimulation(createSimulation({ seed: 987, config: survive }), 80);
    expect(a.stats.births).not.toBe(b.stats.births);
    expect(a.stats.population).not.toBe(b.stats.population);
  });

  it("is byte-for-byte deterministic for the same config and seed", () => {
    const a = runSimulation(createSimulation({ seed: 9321, config: balanced }), 180);
    const b = runSimulation(createSimulation({ seed: 9321, config: balanced }), 180);
    expect(snapshotSimulation(a)).toEqual(snapshotSimulation(b));
    expect(a.generation).toBeLessThanOrEqual(180);
    expect(["extinct", "surviving", "thriving"]).toContain(a.outcome);
    expect(a.stats).toMatchObject({ births: expect.any(Number), deaths: expect.any(Number), maxGeneration: expect.any(Number), lineages: expect.any(Number) });
  });
});
