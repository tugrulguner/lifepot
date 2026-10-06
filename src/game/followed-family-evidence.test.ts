import { expect, it } from "vitest";
import { createRunEvidence, followRunLineage, observeRun } from "./run-evidence";
import { createSimulation, stepSimulation } from "./world";
import { defaultConfig } from "./setup";

it("retains the first observed followed-family extinction through later ticks, unpinning and switching families without changing the engine", () => {
  const initial = createSimulation({ seed: 42, config: defaultConfig() });
  const founder = initial.guild.findIndex(Boolean);
  const lineage = initial.lineage[founder];
  const before = structuredClone(initial);
  let evidence = followRunLineage(createRunEvidence(initial), initial, lineage);
  const extinct = { ...initial, generation: 7, guild: initial.guild.slice() };
  for (let i = 0; i < extinct.guild.length; i++) if (extinct.lineage[i] === lineage) extinct.guild[i] = 0;
  evidence = observeRun(evidence, extinct);
  evidence = observeRun(evidence, { ...extinct, generation: 8 });
  evidence = followRunLineage(evidence, extinct, null);
  evidence = followRunLineage(evidence, extinct, extinct.lineage[extinct.guild.findIndex(Boolean)]);
  expect(evidence.lineageExtinction).toEqual([{ lineage, generation: 7 }]);
  expect(initial).toEqual(before);
  expect(stepSimulation(initial)).toEqual(stepSimulation(before));
  expect(createRunEvidence(initial).lineageExtinction).toEqual([]);
});

it("does not invent a transition for a family already absent when followed", () => {
  const state = createSimulation({ seed: 42, config: defaultConfig() });
  const evidence = followRunLineage(createRunEvidence(state), state, 999999);
  expect(observeRun(evidence, { ...state, generation: 1 }).lineageExtinction).toEqual([]);
});

it("tracks configured rule species despite heritable variant changes and retains their first transition", () => {
  const initial = createSimulation({ seed: 42, config: defaultConfig() });
  const before = structuredClone(initial);
  const changed = { ...initial, generation: 1, species: initial.species.slice() };
  changed.species.fill(999);
  const evidence = observeRun(createRunEvidence(initial), changed);
  expect(evidence.firstExtinction).toEqual([]);
  expect(evidence.samples[1].species).toEqual(evidence.samples[0].species);
  const emptySpecies = { ...changed, generation: 2, guild: changed.guild.slice() };
  for (let i = 0; i < emptySpecies.guild.length; i++) if (emptySpecies.ruleSpecies[i] === 1) emptySpecies.guild[i] = 0;
  const result = observeRun(observeRun(evidence, emptySpecies), { ...emptySpecies, generation: 3 });
  expect(result.firstExtinction).toEqual([{ speciesId: initial.config.rules!.species[0].id, generation: 2 }]);
  expect(initial).toEqual(before);
});
