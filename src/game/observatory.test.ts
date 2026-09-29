import { describe, expect, it } from "vitest";
import { defaultConfig } from "./setup";
import { createSimulation, stepSimulation } from "./world";
import { buildWorldReport } from "./observatory";

describe("world observatory", () => {
  it("summarizes live populations, lineages, traits, and environmental state", () => {
    const initial = createSimulation({ seed: 41, config: defaultConfig() });
    const report = buildWorldReport(initial, []);

    expect(report.population.total).toBe(initial.stats.population);
    expect(report.population.births).toBe(0);
    expect(report.species.map((row) => row.population).reduce((sum, value) => sum + value, 0)).toBe(initial.stats.population);
    expect(report.species.map((row) => row.id)).toEqual(["A", "B"]);
    expect(report.species.every((row) => row.meanEnergy > 0)).toBe(true);
    expect(report.species.every((row) => Object.keys(row.traits).length === 5)).toBe(true);
    expect(report.environment).toMatchObject({ pressure: "stability", intensity: "medium", regeneration: "steady" });
  });

  it("reports changes against the oldest retained frame without inventing events", () => {
    let state = createSimulation({ seed: 7, config: defaultConfig() });
    for (let generation = 0; generation < 8; generation += 1) state = stepSimulation(state);
    const report = buildWorldReport(state, []);

    expect(report.population.change).toBe(state.stats.population - (state.history[0].prey + state.history[0].predators));
    expect(report.resources.change).toBeCloseTo((state.stats.resources - state.history[0].resources) / 2500, 2);
    expect(report.timeline).toEqual([]);
    expect(report.history.at(-1)?.generation).toBe(state.generation);
  });
});
