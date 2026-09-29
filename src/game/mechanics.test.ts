import { describe, expect, it } from "vitest";
import { defaultConfig } from "./setup";
import { defaultRuleGraph, type TrophicRole } from "./rules";
import { createSimulation, indexOf, snapshotSimulation, stepSimulation, type OrganismSeed } from "./world";

function founder(role: TrophicRole, strategy: OrganismSeed["strategy"] = "ambush", energy = 100): OrganismSeed {
  return { x: 10, y: 10, guild: role === "hunter" || role === "omnivore" ? "predator" : "prey", ruleSpecies: 1, energy, lineage: 1, species: 1, generation: 0, strategy, traits: [128,128,128,128,128] };
}
function world(role: TrophicRole, population = [founder(role)]) {
  const rules = defaultRuleGraph();
  rules.species[0] = { id: "A", role, selfInteraction: "neutral" };
  rules.species[1].role = "grazer";
  rules.interactions[0].mode = "neutral";
  return createSimulation({ seed: 93, config: { ...defaultConfig(), rules }, initialPopulation: population, initialResources: [{ x: 10, y: 10, amount: 100 }] });
}

describe("heritable defenses with physical tradeoffs", () => {
  it("charges armor maintenance but reduces hazard exposure", () => {
    const run = (strategy: OrganismSeed["strategy"], harsh: boolean) => {
      const state = world("grazer", [founder("grazer", strategy, 80)]);
      if (harsh) state.config.rules!.environment = { ...state.config.rules!.environment, pressure: "heat_wave", intensity: "high" };
      state.config.environment.hazard = harsh ? "heat" : "drought";
      return stepSimulation(state).energy[indexOf(10, 10)];
    };
    const armorLoss = run("armored", false) - run("armored", true);
    const ordinaryLoss = run("early_brood", false) - run("early_brood", true);
    expect(armorLoss).toBeLessThan(ordinaryLoss);
    expect(run("armored", false)).toBeLessThan(run("early_brood", false));
  });

  it("charges swarming maintenance and grants a bounded same-species group shielding effect", () => {
    const run = (strategy: OrganismSeed["strategy"], grouped: boolean) => {
      const cell = founder("grazer", strategy, 80);
      const state = world("grazer", grouped ? [cell, { ...cell, x: 11, lineage: 2 }] : [cell]);
      return stepSimulation(state);
    };
    const single = run("swarming", false), group = run("swarming", true);
    expect(group.energy[indexOf(10, 10)]).toBeGreaterThan(single.energy[indexOf(10, 10)]);
    expect(single.energy[indexOf(10, 10)]).toBeLessThan(run("early_brood", false).energy[indexOf(10, 10)]);
    expect(snapshotSimulation(run("swarming", true))).toEqual(snapshotSimulation(group));
  });

  it("makes armored prey cost attack energy rather than granting an unconditional kill", () => {
    const hunt = (strategy: OrganismSeed["strategy"], energy: number) => {
      const state = world("grazer", [founder("grazer", strategy, 80), { ...founder("hunter", "pursuit", energy), x: 9, ruleSpecies: 2, species: 2, lineage: 2 }]);
      state.config.rules!.species[1].role = "hunter";
      state.config.rules!.interactions[0].mode = "b_consumes_a";
      return stepSimulation(state);
    };
    expect(hunt("early_brood", 10).stats.kills).toBe(1);
    expect(hunt("armored", 10).stats.kills).toBe(0);
    const defended = hunt("armored", 80), ordinary = hunt("early_brood", 80);
    expect(defended.stats.kills).toBe(1);
    expect(defended.energy[indexOf(10, 10)]).toBeLessThan(ordinary.energy[indexOf(10, 10)]);
  });
});

describe("executable trophic capabilities", () => {
  it("feeds omnivores from basal resources even in an otherwise empty world", () => {
    const initial = world("omnivore");
    const next = stepSimulation(initial);
    const hunter = stepSimulation(world("hunter"));
    const cell = indexOf(10, 10);
    expect(next.resources[cell]).toBeLessThan(initial.resources[cell]);
    expect(next.energy[cell]).toBeGreaterThan(initial.energy[cell]);
    expect(hunter.resources[cell]).toBeGreaterThanOrEqual(initial.resources[cell]);
    expect(hunter.energy[cell]).toBeLessThan(initial.energy[cell]);
    expect(snapshotSimulation(stepSimulation(world("omnivore")))).toEqual(snapshotSimulation(next));
  });

  it("uses basal feeding to cross the reproduction threshold and inherits the declared omnivore species", () => {
    const initial = world("omnivore", [founder("omnivore", "ambush", 165)]);
    const next = stepSimulation(initial);
    expect(next.stats.births).toBe(1);
    expect(next.stats.population).toBe(2);
    for (let i = 0; i < next.guild.length; i++) if (next.guild[i]) {
      expect(next.ruleSpecies[i]).toBe(1);
      expect(next.guild[i]).toBe(2);
      expect(next.lineage[i]).toBe(1);
    }
    expect(next.stats.maxGeneration).toBe(1);
  });
});
