import { describe, expect, it } from "vitest";
import { createRunEvidence, observeRun } from "./run-evidence";
import { createSimulation, stepSimulation, type SimulationState } from "./world";
import { defaultConfig } from "./setup";

function world(): SimulationState {
  return createSimulation({ seed: 42, config: defaultConfig() });
}

describe("session-local run evidence", () => {
  it("starts with generation-zero configured species counts, resources and peak", () => {
    const state = world();
    const evidence = createRunEvidence(state);
    expect(evidence.samples[0]).toMatchObject({ generation: 0, population: state.stats.population, prey: state.stats.prey, predators: state.stats.predators, resources: state.stats.resources, births: 0, deaths: 0, kills: 0 });
    expect(evidence.samples[0].species).toHaveLength(state.config.rules!.species.length);
    expect(evidence.peakPopulation).toBe(state.stats.population);
    expect(evidence.firstExtinction).toEqual([]);
  });

  it("records a compact exact per-generation trajectory and cumulative events", () => {
    const first = stepSimulation(world());
    const second = stepSimulation(first);
    const evidence = observeRun(observeRun(createRunEvidence(world()), first), second);
    expect(evidence.samples.map(sample => sample.generation)).toEqual([0, 1, 2]);
    expect(evidence.samples[2]).toMatchObject({ population: second.stats.population, resources: second.stats.resources, births: second.stats.births, deaths: second.stats.deaths, kills: second.stats.kills });
    expect(evidence.samples[2].species.reduce((sum, species) => sum + species.population, 0)).toBe(second.stats.population);
    expect(evidence.peakPopulation).toBe(Math.max(...evidence.samples.map(sample => sample.population)));
  });

  it("keeps observations idempotent at the same generation", () => {
    const state = stepSimulation(world());
    const evidence = observeRun(observeRun(createRunEvidence(world()), state), state);
    expect(evidence.samples.filter(sample => sample.generation === state.generation)).toHaveLength(1);
  });

  it("does not call configured species with no founders extinct", () => {
    const state = createSimulation({ seed: 42, config: defaultConfig(), initialPopulation: [] });
    expect(createRunEvidence(state).firstExtinction).toEqual([]);
  });

  it("records only positive-to-zero configured species transitions", () => {
    const state = world();
    const target = state.config.rules!.species[0];
    const slot = state.config.rules!.species.findIndex(item => item.id === target.id) + 1;
    const founded = { ...state, guild: new Uint8Array(state.guild.map((_, i) => i === 0 ? 1 : 0)), ruleSpecies: new Uint8Array(state.ruleSpecies.map((_, i) => i === 0 ? slot : 0)), stats: { ...state.stats, population: 1 } };
    const empty = { ...founded, generation: 1, guild: new Uint8Array(state.guild.length), ruleSpecies: new Uint8Array(state.ruleSpecies.length), stats: { ...state.stats, population: 0, prey: 0, predators: 0 } };
    const evidence = observeRun(createRunEvidence(founded), empty);
    expect(evidence.firstExtinction).toContainEqual({ speciesId: target.id, generation: 1 });
    expect(evidence.firstExtinction).toHaveLength(1);
  });

  it("records observed rule activation and reversion boundaries", () => {
    const initial = world();
    const active = { ...initial, generation: 3, activeRuleChange: { sourceGeneration: 1, activatedAt: 3, revertAt: 5, previousRules: initial.config.rules! } };
    const reverted = { ...initial, generation: 6, activeRuleChange: undefined, config: { ...initial.config, rules: { ...initial.config.rules!, version: initial.config.rules!.version + 2 } } };
    const evidence = observeRun(observeRun(createRunEvidence(initial), active), reverted);
    expect(evidence.ruleEvents).toEqual([{ kind: "activated", generation: 3, sourceGeneration: 1, revertAt: 5 }, { kind: "reverted", generation: 6 }]);
  });

  it("records each active-to-inactive transition, not maintenance version changes", () => {
    const initial = world();
    const evidence = createRunEvidence(initial);
    const maintenance = { ...initial, generation: 1, config: { ...initial.config, rules: { ...initial.config.rules!, version: initial.config.rules!.version + 1 } } };
    const active1 = { ...maintenance, generation: 2, activeRuleChange: { sourceGeneration: 1, activatedAt: 2, revertAt: 4, previousRules: initial.config.rules! } };
    const none1 = { ...maintenance, generation: 4, activeRuleChange: undefined };
    const active2 = { ...maintenance, generation: 6, activeRuleChange: { sourceGeneration: 5, activatedAt: 6, revertAt: 8, previousRules: initial.config.rules! } };
    const none2 = { ...maintenance, generation: 9, activeRuleChange: undefined };
    const result = [maintenance, active1, none1, active2, none2].reduce(observeRun, evidence);
    expect(result.ruleEvents).toEqual([
      { kind: "activated", generation: 2, sourceGeneration: 1, revertAt: 4 }, { kind: "reverted", generation: 4 },
      { kind: "activated", generation: 6, sourceGeneration: 5, revertAt: 8 }, { kind: "reverted", generation: 9 },
    ]);
  });
});
