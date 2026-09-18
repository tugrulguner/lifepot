import { z } from "zod";

export const SPECIES_IDS = ["A", "B", "C", "D"] as const;
export const SPECIES_PAIRS = ["A:B", "A:C", "A:D", "B:C", "B:D", "C:D"] as const;
export const TROPHIC_ROLES = ["producer", "grazer", "hunter", "scavenger", "omnivore"] as const;
export const SELF_INTERACTIONS = ["cooperative", "territorial", "cannibalistic", "neutral"] as const;
export const PAIR_INTERACTIONS = ["a_consumes_b", "b_consumes_a", "competition", "mutualism", "avoidance", "neutral"] as const;
export const REGENERATION_MODES = ["steady", "pulsed", "depletion_feedback"] as const;
export const ENVIRONMENT_PRESSURES = ["stability", "drought", "toxin_wave", "heat_wave", "fragmentation", "nutrient_bloom"] as const;
export const VOLATILITY_MODES = ["stable", "pulsing", "chaotic"] as const;
export const INTENSITIES = ["low", "medium", "high"] as const;
export const DURATIONS = ["short", "medium", "long", "persistent"] as const;
export const ACTIVATIONS = ["immediate", "after_6", "after_12", "after_24", "resources_low", "population_boom", "population_crash", "species_emergence", "species_extinction", "predation_high"] as const;
export const TRANSITIONS = ["abrupt", "ramp", "pulse"] as const;

export type SpeciesId = (typeof SPECIES_IDS)[number];
export type TrophicRole = (typeof TROPHIC_ROLES)[number];
export type SelfInteraction = (typeof SELF_INTERACTIONS)[number];
export type PairInteraction = (typeof PAIR_INTERACTIONS)[number];
export type SpeciesPair = (typeof SPECIES_PAIRS)[number];
export type EnvironmentRules = {
  regeneration: (typeof REGENERATION_MODES)[number];
  pressure: (typeof ENVIRONMENT_PRESSURES)[number];
  volatility: (typeof VOLATILITY_MODES)[number];
  intensity: (typeof INTENSITIES)[number];
  duration: (typeof DURATIONS)[number];
};
export type WorldRuleGraph = {
  version: number;
  species: Array<{ id: SpeciesId; role: TrophicRole; selfInteraction: SelfInteraction }>;
  interactions: Array<{ pair: SpeciesPair; mode: PairInteraction }>;
  environment: EnvironmentRules;
};

const speciesSchema = z.object({ id: z.enum(SPECIES_IDS), role: z.enum(TROPHIC_ROLES), selfInteraction: z.enum(SELF_INTERACTIONS) }).strict();
const interactionSchema = z.object({ pair: z.enum(SPECIES_PAIRS), mode: z.enum(PAIR_INTERACTIONS) }).strict();
const environmentSchema = z.object({
  regeneration: z.enum(REGENERATION_MODES),
  pressure: z.enum(ENVIRONMENT_PRESSURES),
  volatility: z.enum(VOLATILITY_MODES),
  intensity: z.enum(INTENSITIES),
  duration: z.enum(DURATIONS),
}).strict();
export const worldRuleGraphSchema = z.object({ version: z.number().int().min(1), species: z.array(speciesSchema).min(2).max(4), interactions: z.array(interactionSchema).min(1).max(6), environment: environmentSchema }).strict();

function expectedPairs(ids: readonly SpeciesId[]): SpeciesPair[] {
  const pairs: SpeciesPair[] = [];
  for (let left = 0; left < ids.length; left += 1) {
    for (let right = left + 1; right < ids.length; right += 1) pairs.push(`${ids[left]}:${ids[right]}` as SpeciesPair);
  }
  return pairs;
}

export function validateRuleGraph(input: unknown): WorldRuleGraph {
  const parsed = worldRuleGraphSchema.safeParse(input);
  if (!parsed.success) throw new Error("Invalid ecosystem rule graph");
  const graph = parsed.data as WorldRuleGraph;
  const ids = graph.species.map((species) => species.id);
  const expectedIds = SPECIES_IDS.slice(0, ids.length);
  if (ids.some((id, index) => id !== expectedIds[index])) throw new Error("Invalid ecosystem rule graph: species must be unique and canonical");
  const pairs = graph.interactions.map((interaction) => interaction.pair);
  const canonicalPairs = expectedPairs(ids);
  if (pairs.length !== canonicalPairs.length || pairs.some((pair, index) => pair !== canonicalPairs[index])) throw new Error("Invalid ecosystem rule graph: pair relationships must be complete and canonical");
  if (!graph.species.some((species) => species.role === "producer" || species.role === "grazer" || species.role === "omnivore")) throw new Error("Invalid ecosystem rule graph: no viable basal energy path");
  return structuredClone(graph);
}

const pairPatchSchema = z.object({ kind: z.literal("pair"), pair: z.enum(SPECIES_PAIRS), mode: z.enum(PAIR_INTERACTIONS) }).strict();
const selfPatchSchema = z.object({ kind: z.literal("self"), species: z.enum(SPECIES_IDS), value: z.enum(SELF_INTERACTIONS) }).strict();
const environmentPatchSchema = z.discriminatedUnion("field", [
  z.object({ kind: z.literal("environment"), field: z.literal("regeneration"), value: z.enum(REGENERATION_MODES) }).strict(),
  z.object({ kind: z.literal("environment"), field: z.literal("pressure"), value: z.enum(ENVIRONMENT_PRESSURES) }).strict(),
  z.object({ kind: z.literal("environment"), field: z.literal("volatility"), value: z.enum(VOLATILITY_MODES) }).strict(),
  z.object({ kind: z.literal("environment"), field: z.literal("intensity"), value: z.enum(INTENSITIES) }).strict(),
  z.object({ kind: z.literal("environment"), field: z.literal("duration"), value: z.enum(DURATIONS) }).strict(),
]);
const patchSchema = z.union([pairPatchSchema, selfPatchSchema, environmentPatchSchema]);
export type RulePatch = z.infer<typeof patchSchema>;

export function validateRulePatch(input: unknown): RulePatch {
  const parsed = patchSchema.safeParse(input);
  if (!parsed.success) throw new Error("Invalid ecosystem rule patch");
  return structuredClone(parsed.data);
}

export function applyRulePatch(graphInput: WorldRuleGraph, patchInput: RulePatch): WorldRuleGraph {
  const graph = validateRuleGraph(graphInput);
  const patch = validateRulePatch(patchInput);
  if (patch.kind === "pair") {
    const index = graph.interactions.findIndex((interaction) => interaction.pair === patch.pair);
    if (index < 0) throw new Error("Invalid ecosystem rule patch: unknown pair");
    graph.interactions[index] = { pair: patch.pair as SpeciesPair, mode: patch.mode };
  } else if (patch.kind === "self") {
    const species = graph.species.find((candidate) => candidate.id === patch.species);
    if (!species) throw new Error("Invalid ecosystem rule patch: unknown species");
    species.selfInteraction = patch.value;
  } else {
    graph.environment = { ...graph.environment, [patch.field]: patch.value } as EnvironmentRules;
  }
  graph.version += 1;
  return validateRuleGraph(graph);
}

export const scheduledRuleChangeSchema = z.object({
  decidedAtGeneration: z.number().int().min(0).max(180),
  activation: z.enum(ACTIVATIONS),
  duration: z.enum(DURATIONS),
  transition: z.enum(TRANSITIONS),
  patch: patchSchema,
}).strict();
export type ScheduledRuleChange = z.infer<typeof scheduledRuleChangeSchema>;
export type RuleActivationState = {
  resourceBand: "low" | "balanced" | "high";
  populationBand: "crash" | "stable" | "boom";
  speciesEmerged?: boolean;
  speciesExtinct?: boolean;
  predationHigh?: boolean;
};

export function validateScheduledRuleChange(input: unknown): ScheduledRuleChange {
  const parsed = scheduledRuleChangeSchema.safeParse(input);
  if (!parsed.success) throw new Error("Invalid scheduled rule change");
  return structuredClone(parsed.data);
}

export function ruleChangeDue(changeInput: ScheduledRuleChange, generation: number, state: RuleActivationState): boolean {
  const change = validateScheduledRuleChange(changeInput);
  if (generation < change.decidedAtGeneration) return false;
  if (change.activation === "immediate") return generation >= change.decidedAtGeneration;
  if (change.activation.startsWith("after_")) return generation >= change.decidedAtGeneration + Number(change.activation.slice(6));
  if (change.activation === "resources_low") return state.resourceBand === "low";
  if (change.activation === "population_boom") return state.populationBand === "boom";
  if (change.activation === "population_crash") return state.populationBand === "crash";
  if (change.activation === "species_emergence") return state.speciesEmerged === true;
  if (change.activation === "species_extinction") return state.speciesExtinct === true;
  return state.predationHigh === true;
}

export function defaultRuleGraph(): WorldRuleGraph {
  return {
    version: 1,
    species: [
      { id: "A", role: "grazer", selfInteraction: "cooperative" },
      { id: "B", role: "hunter", selfInteraction: "territorial" },
    ],
    interactions: [{ pair: "A:B", mode: "b_consumes_a" }],
    environment: { regeneration: "steady", pressure: "stability", volatility: "stable", intensity: "medium", duration: "persistent" },
  };
}
