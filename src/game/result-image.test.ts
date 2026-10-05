import { describe, expect, it } from "vitest";
import { createSimulation } from "./world";
import { buildResultImageModel, drawResultImage } from "./result-image";
import { defaultConfig } from "./setup";

describe("buildResultImageModel", () => {
  it("summarizes actual final board cells, living species and resources", () => {
    const state = createSimulation({ seed: 3, config: defaultConfig() });
    state.generation = 41;
    state.outcome = "thriving";
    state.guild.fill(0);
    state.species.fill(0);
    state.guild[7] = 1; state.species[7] = 2; state.ruleSpecies[7] = 1;
    state.guild[19] = 2; state.species[19] = 4; state.ruleSpecies[19] = 2;
    state.resources.fill(0); state.resources[2] = 30;
    const model = buildResultImageModel(state, "A question", "Horizon reached");
    expect(model.generation).toBe(41);
    expect(model.outcome).toBe("thriving");
    expect(model.cells[7]).toMatchObject({ guild: 1, species: "A" });
    expect(model.cells[19]).toMatchObject({ guild: 2, species: "B" });
    expect(model.cells[8].guild).toBe(0);
    expect(model.speciesCounts).toEqual([{ species: "A", count: 1 }, { species: "B", count: 1 }]);
    expect(model.totalResources).toBe(30);
    expect(model.stopReason).toBe("Horizon reached");
  });
  it("does not mutate state and wraps long text in a stable model", () => {
    const state = createSimulation({ seed: 4, config: defaultConfig() });
    const before = state.guild.slice();
    const model = buildResultImageModel(state, "Question", "Exact ending");
    expect(state.guild).toEqual(before);
    expect(model.question).toBe("Question");
    expect(model.boardSize).toBe(50);
  });

  it("uses configured species identity, not heritable variants, and retains extinct configured species", () => {
    const state = createSimulation({ seed: 5, config: defaultConfig() });
    state.guild.fill(0); state.species.fill(0); state.ruleSpecies.fill(0);
    state.guild[1] = 1; state.species[1] = 28; state.ruleSpecies[1] = 1;
    state.guild[2] = 2; state.species[2] = 7; state.ruleSpecies[2] = 2;
    const model = buildResultImageModel(state, "", "ended");
    expect(model.cells[1]).toMatchObject({ species: state.config.rules!.species[0].id, role: state.config.rules!.species[0].role });
    expect(model.cells[2]).toMatchObject({ species: state.config.rules!.species[1].id, role: state.config.rules!.species[1].role });
    expect(model.speciesCounts).toHaveLength(state.config.rules!.species.length);
    expect(model.speciesCounts.map(item => item.species)).toEqual(state.config.rules!.species.map(item => item.id));
  });

  it("draws a compact board and places URL beneath it while including cumulative evidence", () => {
    const state = createSimulation({ seed: 6, config: defaultConfig() });
    state.stats.births = 12; state.stats.deaths = 9; state.stats.kills = 3;
    const model = buildResultImageModel(state, "", "Observation horizon reached (180 generations)", { births: 12, deaths: 9, kills: 3 });
    const calls: Array<[string, ...unknown[]]> = [];
    const ctx = new Proxy({ measureText: (text: string) => ({ width: text.length * 10 }) }, { get(target, key) { if (key in target) return target[key as keyof typeof target]; return (...args: unknown[]) => calls.push([String(key), ...args]); }, set(_target, key, value) { calls.push([`set:${String(key)}`, value]); return true; } }) as unknown as CanvasRenderingContext2D;
    drawResultImage(ctx, model);
    expect(model.cells[0]).toHaveProperty("role");
    expect(model.totalBirths).toBe(12);
    expect(calls.some(call => call[0] === "fillText" && call[1] === "https://lifepot.modepot.io" && Number(call[3]) > 900)).toBe(true);
    expect(model.width).toBe(1600);
  });
});
