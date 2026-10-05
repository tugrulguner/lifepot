import { lifeConfigSchema, type SetupAnswers } from "./setup";
import { defaultRuleGraph, validateRuleGraph, type PairInteraction, type RulePatch, type SpeciesId, type TrophicRole } from "./rules";
import type { LifeConfig } from "./world";
import { relationshipLabel } from "./visuals";

export type WorldPreviewData = {
  species: Array<{ id: SpeciesId; role: TrophicRole; count: number; name: string }>;
  relationships: Array<{ pair: string; mode: PairInteraction; description: string }>;
  environment: string[];
  founders: string;
  stoppingRule: string;
  policyDisclosure: string;
  warnings: string[];
};
export type WorldEdit = RulePatch | { kind: "role"; species: SpeciesId; role: TrophicRole } | { kind: "abundance"; value: LifeConfig["environment"]["abundance"] } | { kind: "distribution"; value: LifeConfig["environment"]["distribution"] } | { kind: "pressure"; value: NonNullable<LifeConfig["rules"]>["environment"]["pressure"] } | { kind: "intensity"; value: NonNullable<LifeConfig["rules"]>["environment"]["intensity"] } | { kind: "regeneration"; value: NonNullable<LifeConfig["rules"]>["environment"]["regeneration"] } | { kind: "balance"; value: LifeConfig["founders"]["balance"] };


const human = (value: string) => value.replaceAll("_", " ");
export function interpretWorldPreview(config: LifeConfig, answers: SetupAnswers): WorldPreviewData {
  const graph = validateRuleGraph(config.rules ?? defaultRuleGraph());
  const species = graph.species.map((item) => ({ id: item.id, role: item.role, name: item.id, count: Math.max(3, Math.round(({ producer: 18, grazer: 18, hunter: 8, scavenger: 10, omnivore: 10 } as const)[item.role] * (config.founders.balance === "prey_heavy" ? (item.role === "hunter" || item.role === "omnivore" ? .65 : 1.3) : config.founders.balance === "predator_heavy" ? (item.role === "hunter" || item.role === "omnivore" ? 1.5 : .8) : 1))) }));
  const relationships = graph.interactions.map((edge) => ({ pair: edge.pair, mode: edge.mode, description: edge.mode.includes("consumes") ? relationshipLabel(edge.pair, edge.mode) : `Species ${edge.pair.replace(":", " and ")} · ${relationshipLabel(edge.pair, edge.mode)}` }));
  const warnings = graph.species.filter((s) => s.role === "hunter" || s.role === "omnivore").filter((s) => !graph.interactions.some((e) => e.mode === (e.pair.startsWith(`${s.id}:`) ? "a_consumes_b" : e.pair.endsWith(`:${s.id}`) ? "b_consumes_a" : "__none__"))).map((s) => `${s.id} (${s.role}) has no modeled consumption link; the hunter name does not create prey.`);
  const hasConsumption = graph.interactions.some((e) => e.mode === "a_consumes_b" || e.mode === "b_consumes_a");
  if (!hasConsumption && /predat|hunter|hunt|eat|wolf|wolves|lion|shark/i.test(`${answers.world} ${answers.threat} ${answers.reward}`) && !warnings.length) warnings.push("Your setup mentions predation or hunters, but no modeled consumption link exists; no feeding link was added.");
  return { species, relationships, environment: [`${human(config.environment.abundance)} resources`, `${human(config.environment.distribution)} distribution`, `${human(config.environment.hazard)} pressure`, `${human(config.environment.volatility)} variability`, `${human(graph.environment.pressure)} rule pressure at ${graph.environment.intensity} intensity`, `${human(graph.environment.regeneration)} resource regeneration`], founders: `${species.reduce((sum, item) => sum + item.count, 0)} estimated founders (${human(config.founders.balance)}, ${human(config.founders.diversity)})`, stoppingRule: "Observation stops at 180 generations or when the world is empty.", policyDisclosure: `Setup interpretation reflects: “${answers.world}”; threat: “${answers.threat}”; aim: “${answers.reward}”. No new AI interpretation is requested by this preview.`, warnings };
}
export function editWorldPreview(config: LifeConfig, edit: WorldEdit): { config: LifeConfig; warning?: string } {
  const next = structuredClone(config);
  const graph = structuredClone(next.rules ?? defaultRuleGraph());
  if (edit.kind === "pair") { const target = graph.interactions.find((x) => x.pair === edit.pair); if (!target) throw new Error("Unsupported species pair"); target.mode = edit.mode; graph.version += 1; }
  else if (edit.kind === "role") { const target = graph.species.find((x) => x.id === edit.species); if (!target) throw new Error("Unsupported species"); target.role = edit.role; graph.version += 1; }
  else if (edit.kind === "pressure") { graph.environment.pressure = edit.value; graph.version += 1; }
  else if (edit.kind === "intensity") { graph.environment.intensity = edit.value; graph.version += 1; }
  else if (edit.kind === "regeneration") { graph.environment.regeneration = edit.value; graph.version += 1; }
  else if (edit.kind === "abundance") next.environment.abundance = edit.value;
  else if (edit.kind === "distribution") next.environment.distribution = edit.value;
  else if (edit.kind === "balance") next.founders.balance = edit.value;
  next.rules = validateRuleGraph(graph);
  const parsed = lifeConfigSchema.safeParse(next);
  if (!parsed.success) throw new Error("Edit is incompatible with the setup configuration");
  return { config: parsed.data as LifeConfig, warning: "World conditions were manually edited after setup interpretation." };
}
