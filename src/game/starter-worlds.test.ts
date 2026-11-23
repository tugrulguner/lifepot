import { describe, expect, it } from "vitest";
import { lifeConfigSchema, setupAnswersSchema } from "./setup";
import { worldRuleGraphSchema } from "./rules";
import { createSimulation, snapshotSimulation, stepSimulation } from "./world";
import { createStarterWorld, STARTER_WORLDS, type StarterId } from "./starter-worlds";

const ids: StarterId[] = ["resource-competition", "hunters-and-prey", "recurring-scarcity"];

describe("bounded starter ecologies", () => {
  it("provides explicit, bounded metadata and valid starter payloads", () => {
    expect(STARTER_WORLDS.map(({ id }) => id)).toEqual(ids);
    for (const id of ids) {
      const starter = createStarterWorld(id);
      expect(starter.id).toBe(id);
      expect(starter.title.length).toBeGreaterThan(0);
      const metadata = STARTER_WORLDS.find(item => item.id === id)!;
      expect(metadata.description.length).toBeGreaterThan(0);
      expect(metadata.question.length).toBeGreaterThan(0);
      expect(lifeConfigSchema.safeParse(starter.config).success).toBe(true);
      expect(worldRuleGraphSchema.safeParse(starter.config.rules).success).toBe(true);
      expect(setupAnswersSchema.safeParse(starter.answers).success).toBe(true);
      expect(Object.values(starter.answers).every(answer => answer.length <= 140)).toBe(true);
      expect(createSimulation({ seed: starter.seed, config: starter.config }).generation).toBe(0);
    }
  });

  it("makes competition two basal feeders with a competition link and no trophic link", () => {
    const { config } = createStarterWorld("resource-competition");
    expect(config.environment.hazard).toBe('crowding');
    expect(config.rules!.environment.pressure).toBe('stability');
    expect(config.rules!.species.map(species => species.role)).toEqual(["grazer", "grazer"]);
    expect(config.rules!.interactions).toEqual([{ pair: "A:B", mode: "competition" }]);
    let state = createSimulation({ seed: 1, config });
    state = stepSimulation(state);
    const feedingSlots = new Set(state.events.filter(event => event.kind === "feeding" && event.source === "resource").map(event => event.organismId));
    expect(feedingSlots.size).toBeGreaterThan(0);
    expect(state.stats.predators).toBe(0);
  });

  it("has an actual directed hunter edge and a supported predator strategy", () => {
    const { config } = createStarterWorld("hunters-and-prey");
    expect(config.rules!.species.map(species => species.role)).toEqual(["grazer", "hunter"]);
    expect(config.rules!.interactions).toEqual([{ pair: "A:B", mode: "b_consumes_a" }]);
    expect(["ambush", "pursuit", "pack_hunting", "efficient_kill", "brood_hunting"]).toContain(config.founders.predatorStrategy);
    const initial = createSimulation({ seed: 1, config });
    let state = initial;
    for (let i = 0; i < 12 && state.outcome === "running"; i++) state = stepSimulation(state);
    expect(state.stats.kills).toBeGreaterThan(0);
  });

  it("configures recurring drought as a pulsed environmental pressure", () => {
    const { config } = createStarterWorld("recurring-scarcity");
    expect(config.environment.abundance).toBe("scarce");
    expect(config.environment.hazard).toBe("drought");
    expect(config.environment.volatility).toBe("pulsing");
    expect(config.rules!.environment).toMatchObject({ regeneration: "pulsed", pressure: "drought", volatility: "pulsing" });
  });

  it("uses one seed, distinct explicit answers, reproducible starts, and independent config clones", () => {
    const worlds = ids.map(createStarterWorld);
    expect(new Set(worlds.map(world => world.seed)).size).toBe(1);
    expect(new Set(worlds.map(world => JSON.stringify(world.answers))).size).toBe(ids.length);
    for (const id of ids) expect(snapshotSimulation(createSimulation(createStarterWorld(id)))).toEqual(snapshotSimulation(createSimulation(createStarterWorld(id))));
    const first = createStarterWorld(ids[0]), second = createStarterWorld(ids[0]);
    first.config.rules!.species[0].role = "producer";
    first.answers.world = "mutated";
    expect(second.config.rules!.species[0].role).toBe("grazer");
    expect(second.answers.world).not.toBe("mutated");
    expect(() => createStarterWorld("unknown" as StarterId)).toThrow(/unknown|invalid|starter/i);
  });

  it("runs complete 180-generation trajectories without forcing survival or extinction", () => {
    for (const id of ids) {
      let state = createSimulation(createStarterWorld(id));
      while (state.generation < 180 && state.outcome === "running") state = stepSimulation(state);
      if (state.outcome === "extinct") expect(state.stats.population).toBe(0);
      else expect(state.generation).toBe(180);
      expect(["extinct", "surviving", "thriving"]).toContain(state.outcome);
    }
  });
});
