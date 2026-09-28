import { z } from "zod";
import { GRID_CELLS, GRID_SIZE, TRAIT_COUNT, type SimulationState } from "./world";
import type { SetupAnswers } from "./setup";

export const DECISION_EPOCHS = [0, 30, 60, 90, 120, 150] as const;
export const COHORT_IDS = ["energy_stressed", "efficient_foragers", "explorers", "resilient", "generalists"] as const;
export const CELL_ACTIONS = ["forage", "cluster", "disperse", "reproduce", "conserve"] as const;
export const ENVIRONMENT_ACTIONS = ["bloom", "redistribute", "hazard_surge", "relief", "hold"] as const;

export type DecisionEpoch = (typeof DECISION_EPOCHS)[number];
export type CohortId = (typeof COHORT_IDS)[number];
export type CellAction = (typeof CELL_ACTIONS)[number];
export type EnvironmentAction = (typeof ENVIRONMENT_ACTIONS)[number];
export type DecisionSource = "jev" | "fallback";
export type DecisionAnswer<T extends string> = { choice: T; confidence: number; probabilities: Record<T, number> };
export type EpochDecision = {
  generation: DecisionEpoch;
  source: DecisionSource;
  model?: string;
  usage?: { input_tokens: number; output_tokens: number };
  cohorts: Record<CohortId, DecisionAnswer<CellAction>>;
  environment: DecisionAnswer<EnvironmentAction>;
};
export type EpochLedger = EpochDecision[];
export type CohortSummary = {
  id: CohortId;
  count: number;
  meanEnergy: number;
  meanLocalPressure: number;
  meanResource: number;
  meanHazard: number;
  meanTraits: readonly [number, number, number, number, number];
};
export type EpochStateSummary = {
  generation: number;
  intent: SetupAnswers;
  environment: SimulationState["config"]["environment"];
  fitness: SimulationState["config"]["fitness"];
  world: { population: number; births: number; deaths: number; meanEnergy: number; meanResource: number; meanHazard: number };
  cohorts: readonly CohortSummary[];
};

const probability = z.number().finite().min(0).max(1);
// Jev transports rounded probabilities, so a valid distribution may total 0.99 or 1.01.
const normalized = (value: Record<string, number>) => Math.abs(Object.values(value).reduce<number>((sum, item) => sum + item, 0) - 1) <= 0.011;
function answerSchema<const T extends readonly [string, ...string[]]>(options: T) {
  return z.object({
    choice: z.enum(options),
    confidence: probability,
    probabilities: z.record(z.enum(options), probability)
      .refine((value) => Object.keys(value).length === options.length && normalized(value), "probabilities must cover every action and sum to one"),
  }).strict().superRefine((answer, context) => {
    if (answer.probabilities[answer.choice] !== Math.max(...Object.values(answer.probabilities) as number[])) {
      context.addIssue({ code: "custom", message: "selected action must have maximum probability" });
    }
  });
}
const decisionSchema = z.object({
  generation: z.union(DECISION_EPOCHS.map((epoch) => z.literal(epoch)) as unknown as [z.ZodLiteral<DecisionEpoch>, z.ZodLiteral<DecisionEpoch>, ...z.ZodLiteral<DecisionEpoch>[]]),
  source: z.enum(["jev", "fallback"]),
  model: z.string().min(1).max(100).optional(),
  usage: z.object({ input_tokens: z.number().int().nonnegative(), output_tokens: z.number().int().nonnegative() }).strict().optional(),
  cohorts: z.object(Object.fromEntries(COHORT_IDS.map((id) => [id, answerSchema(CELL_ACTIONS)])) as unknown as Record<CohortId, ReturnType<typeof answerSchema>>).strict(),
  environment: answerSchema(ENVIRONMENT_ACTIONS),
}).strict();

function round(value: number): number { return Math.round(value * 100) / 100; }
function neighbors(index: number): number[] {
  const x = index % GRID_SIZE; const y = Math.floor(index / GRID_SIZE); const result: number[] = [];
  for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
    if (!dx && !dy) continue;
    result.push((((y + dy + GRID_SIZE) % GRID_SIZE) * GRID_SIZE) + ((x + dx + GRID_SIZE) % GRID_SIZE));
  }
  return result;
}

export function cohortForCell(state: SimulationState, index: number): CohortId {
  if (state.energy[index] < 45) return "energy_stressed";
  const offset = index * TRAIT_COUNT;
  if (state.traits[offset] >= 190) return "efficient_foragers";
  if (state.traits[offset + 2] >= 190) return "explorers";
  if (state.traits[offset + 3] >= 190) return "resilient";
  return "generalists";
}

export function summarizeEpochState(state: SimulationState, intent: SetupAnswers): EpochStateSummary {
  const accumulators = Object.fromEntries(COHORT_IDS.map((id) => [id, { id, count: 0, energy: 0, pressure: 0, resource: 0, hazard: 0, traits: [0, 0, 0, 0, 0] }])) as Record<CohortId, { id: CohortId; count: number; energy: number; pressure: number; resource: number; hazard: number; traits: number[] }>;
  let totalEnergy = 0; let totalResources = 0; let totalHazards = 0;
  for (let i = 0; i < GRID_CELLS; i += 1) {
    totalResources += state.resources[i]; totalHazards += state.hazards[i];
    if (!state.occupied[i]) continue;
    const group = accumulators[cohortForCell(state, i)];
    group.count += 1; group.energy += state.energy[i]; totalEnergy += state.energy[i];
    group.pressure += neighbors(i).reduce((count, neighbor) => count + state.occupied[neighbor], 0);
    group.resource += state.resources[i]; group.hazard += state.hazards[i];
    for (let trait = 0; trait < TRAIT_COUNT; trait += 1) group.traits[trait] += state.traits[i * TRAIT_COUNT + trait];
  }
  const cohorts = COHORT_IDS.map((id): CohortSummary => {
    const group = accumulators[id]; const divisor = group.count || 1;
    return Object.freeze({
      id, count: group.count, meanEnergy: round(group.energy / divisor), meanLocalPressure: round(group.pressure / divisor),
      meanResource: round(group.resource / divisor), meanHazard: round(group.hazard / divisor),
      meanTraits: Object.freeze(group.traits.map((value) => round(value / divisor))) as unknown as CohortSummary["meanTraits"],
    });
  });
  return Object.freeze({
    generation: state.generation,
    intent: Object.freeze({ ...intent }),
    environment: Object.freeze({ ...state.config.environment }),
    fitness: Object.freeze({ ...state.config.fitness }),
    world: Object.freeze({ population: state.stats.population, births: state.stats.births, deaths: state.stats.deaths, meanEnergy: round(totalEnergy / (state.stats.population || 1)), meanResource: round(totalResources / GRID_CELLS), meanHazard: round(totalHazards / GRID_CELLS) }),
    cohorts: Object.freeze(cohorts),
  });
}

export function validateEpochDecision(input: unknown): EpochDecision {
  const parsed = decisionSchema.safeParse(input);
  if (!parsed.success) throw new Error("Invalid epoch decision");
  return parsed.data as EpochDecision;
}

function certain<T extends string>(choice: T, options: readonly T[]): DecisionAnswer<T> {
  return { choice, confidence: 1, probabilities: Object.fromEntries(options.map((option) => [option, option === choice ? 1 : 0])) as Record<T, number> };
}

export function deterministicEpochDecision(summary: EpochStateSummary): EpochDecision {
  const cohortDefaults: Record<CohortId, CellAction> = {
    energy_stressed: "conserve",
    efficient_foragers: "forage",
    explorers: "disperse",
    resilient: "cluster",
    generalists: summary.world.meanEnergy > 125 ? "reproduce" : "forage",
  };
  const environment: EnvironmentAction = summary.world.meanHazard > 22 ? "relief" : summary.world.meanResource < 55 ? "bloom" : summary.world.population > 350 ? "redistribute" : "hold";
  return validateEpochDecision({
    generation: summary.generation,
    source: "fallback",
    cohorts: Object.fromEntries(COHORT_IDS.map((id) => [id, certain(cohortDefaults[id], CELL_ACTIONS)])),
    environment: certain(environment, ENVIRONMENT_ACTIONS),
  });
}

export function decisionEpochAt(generation: number): DecisionEpoch | null {
  return (DECISION_EPOCHS as readonly number[]).includes(generation) ? generation as DecisionEpoch : null;
}
