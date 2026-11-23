import { defaultConfig, setupAnswersSchema, type SetupAnswers, lifeConfigSchema } from "./setup";
import { defaultRuleGraph, worldRuleGraphSchema } from "./rules";
import type { LifeConfig } from "./world";

export type StarterId = "resource-competition" | "hunters-and-prey" | "recurring-scarcity";

type StarterMetadata = { id: StarterId; title: string; description: string; question: string };
export const STARTER_WORLDS: readonly StarterMetadata[] = [
  { id: "resource-competition", title: "Resource competition", description: "Two resource-feeding species share a world and compete without a predator link.", question: "How does shared resource competition change each species over time?" },
  { id: "hunters-and-prey", title: "Hunters and prey", description: "A directed hunter–grazer relationship makes predation possible in the starting ecology.", question: "How does predation reshape the balance between hunters and prey?" },
  { id: "recurring-scarcity", title: "Recurring scarcity", description: "Scarce resources meet pulsed regeneration and recurring drought pressure.", question: "Which populations persist through recurring drought and resource scarcity?" },
] as const;

export type StarterWorld = { id: StarterId; title: string; config: LifeConfig; answers: SetupAnswers; seed: number };
const STARTER_SEED = 241;
const ANSWERS: Record<StarterId, SetupAnswers> = {
  "resource-competition": { world: "A shared plain with balanced scattered resources", threat: "Crowding and resource competition", reward: "Observe whether both species persist" },
  "hunters-and-prey": { world: "A balanced grassland with scattered resources", threat: "Predator packs hunt prey", reward: "Explore how predator and prey populations change" },
  "recurring-scarcity": { world: "A barren seasonal landscape with scarce resources", threat: "Recurring pulsed drought", reward: "Survive and adapt through repeated scarcity" },
};

export function createStarterWorld(id: StarterId): StarterWorld {
  const metadata = STARTER_WORLDS.find((starter) => starter.id === id);
  if (!metadata) throw new Error(`Unknown starter world: ${String(id)}`);

  const config = defaultConfig();
  config.rules = defaultRuleGraph();
  if (id === "resource-competition") {
    config.environment.hazard = "crowding";
    config.rules.environment.pressure = "stability";
    config.rules.species[1] = { ...config.rules.species[1], role: "grazer", selfInteraction: "cooperative" };
    config.rules.interactions[0] = { pair: "A:B", mode: "competition" };
    config.founders.predatorStrategy = "pursuit";
    config.founders.balance = "prey_heavy";
  } else if (id === "hunters-and-prey") {
    config.rules.interactions[0] = { pair: "A:B", mode: "b_consumes_a" };
    config.founders.predatorStrategy = "pack_hunting";
    config.founders.balance = "prey_heavy";
  } else {
    config.environment = { abundance: "scarce", distribution: "seasonal", hazard: "drought", volatility: "pulsing" };
    config.rules.environment = { regeneration: "pulsed", pressure: "drought", volatility: "pulsing", intensity: "high", duration: "persistent" };
    config.founders.balance = "prey_heavy";
    config.founders.preyStrategy = "dispersal";
    config.founders.predatorStrategy = "ambush";
  }
  const answers = setupAnswersSchema.parse(structuredClone(ANSWERS[id]));
  const parsedConfig = lifeConfigSchema.parse(structuredClone(config));
  parsedConfig.rules = worldRuleGraphSchema.parse(parsedConfig.rules);
  return { id, title: metadata.title, config: parsedConfig, answers, seed: STARTER_SEED };
}
