import { choice, score, TypeSafeClient } from "@typesafe-ai/sdk";
import { z } from "zod";
import {
  ENVIRONMENT_PRESSURES,
  INTENSITIES,
  MUTATION_TARGETS,
  MUTATION_TEMPOS,
  PREDATOR_STRATEGIES,
  PREY_STRATEGIES,
  deterministicEvolutionDecision,
  validateEvolutionDecision,
  type EcologySummary,
  type EvolutionDecision,
} from "@/game/decisions";
import {
  ACTIVATIONS,
  DURATIONS,
  ENVIRONMENT_PRESSURES as RULE_PRESSURES,
  INTENSITIES as RULE_INTENSITIES,
  PAIR_INTERACTIONS,
  REGENERATION_MODES,
  SELF_INTERACTIONS,
  TROPHIC_ROLES,
  TRANSITIONS,
  validateRuleGraph,
  type SpeciesPair,
  type WorldRuleGraph,
} from "@/game/rules";
import { deterministicSetup, hashSetupRequest, lifeConfigSchema, normalizeFitness, type SetupAnswers } from "@/game/setup";
import type { LifeConfig } from "@/game/world";
import type { SetupRequest } from "./schema";

type Usage = { input_tokens: number; output_tokens: number };
export type SetupInterpretation = {
  config: LifeConfig;
  source: "jev" | "fallback";
  requestHash: string;
  model?: string;
  usage?: Usage;
  evidence?: Record<string, unknown>;
};

const criteria = <T extends readonly string[]>(values: T) => Object.fromEntries(values.map((value) => [value, value.replaceAll("_", " ")]));
const setupQuestions = {
  abundance: choice("How abundant are usable resources in `world`?", { scarce: "Limited", balanced: "Moderate or unspecified", rich: "Plentiful" }),
  distribution: choice("How are resources distributed?", { clustered: "Patches", scattered: "Spread", seasonal: "Recurring shifts" }),
  hazard: choice("Which non-organism environmental hazard best matches `threat`?", { drought: "Resource loss", toxin: "Poison", heat: "Heat or fire", crowding: "Spatial pressure" }),
  volatility: choice("How does environmental pressure vary?", { stable: "Constant", pulsing: "Recurring", chaotic: "Irregular" }),
  balance: choice("What initial trophic balance does the text imply?", { prey_heavy: "Mostly basal consumers", balanced: "Balanced", predator_heavy: "Many hunters" }),
  diversity: choice("How much founder diversity supports the objective?", { focused: "Low variation", varied: "Meaningful variation" }),
  preyStrategy: choice("Which initial heritable basal-consumer strategy best serves the objective?", criteria(PREY_STRATEGIES)),
  predatorStrategy: choice("Which initial heritable hunter strategy best serves the objective?", criteria(PREDATOR_STRATEGIES)),
  speciesCount: choice("How many distinct cellular species are needed by the user's world?", { two: "Two species", three: "Three species", four: "Four species" }),
  roleA: choice("What trophic role should species A have?", criteria(TROPHIC_ROLES)),
  roleB: choice("What trophic role should species B have?", criteria(TROPHIC_ROLES)),
  roleC: choice("What trophic role should species C have if present?", criteria(TROPHIC_ROLES)),
  roleD: choice("What trophic role should species D have if present?", criteria(TROPHIC_ROLES)),
  selfA: choice("How do species A cells interact with their own species?", criteria(SELF_INTERACTIONS)),
  selfB: choice("How do species B cells interact with their own species?", criteria(SELF_INTERACTIONS)),
  selfC: choice("How do species C cells interact with their own species if present?", criteria(SELF_INTERACTIONS)),
  selfD: choice("How do species D cells interact with their own species if present?", criteria(SELF_INTERACTIONS)),
  pairAB: choice("What is the ecological relationship between species A and B?", criteria(PAIR_INTERACTIONS)),
  pairAC: choice("What is the relationship between A and C if C is present?", criteria(PAIR_INTERACTIONS)),
  pairAD: choice("What is the relationship between A and D if D is present?", criteria(PAIR_INTERACTIONS)),
  pairBC: choice("What is the relationship between B and C if C is present?", criteria(PAIR_INTERACTIONS)),
  pairBD: choice("What is the relationship between B and D if D is present?", criteria(PAIR_INTERACTIONS)),
  pairCD: choice("What is the relationship between C and D if both are present?", criteria(PAIR_INTERACTIONS)),
  regeneration: choice("Which resource-regeneration law best matches the world?", criteria(REGENERATION_MODES)),
  rulePressure: choice("Which initial environmental pressure law best matches the world?", criteria(RULE_PRESSURES)),
  ruleIntensity: choice("How intense should the initial environmental law be?", criteria(RULE_INTENSITIES)),
  ruleDuration: choice("How long should the initial law persist before Jev may revise it?", criteria(DURATIONS)),
  survive: score("How strongly does `reward` favor survival?", ["None", "Low", "Medium", "High", "Primary"]),
  replicate: score("How strongly does `reward` favor reproduction?", ["None", "Low", "Medium", "High", "Primary"]),
  cooperate: score("How strongly does `reward` favor cooperation?", ["None", "Low", "Medium", "High", "Primary"]),
  explore: score("How strongly does `reward` favor movement?", ["None", "Low", "Medium", "High", "Primary"]),
  adapt: score("How strongly does `reward` favor adaptation?", ["None", "Low", "Medium", "High", "Primary"]),
};

const probability = z.number().finite().min(0).max(1);
const normalized = (values: Record<string, number>) => Math.abs(Object.values(values).reduce((sum, value) => sum + value, 0) - 1) <= 0.011;
function choiceAnswer<const T extends readonly [string, ...string[]]>(options: T) {
  return z.object({ type: z.literal("choice"), choice: z.enum(options), confidence: probability, probabilities: z.record(z.enum(options), probability).refine((values) => Object.keys(values).length === options.length && normalized(values)) }).strict().superRefine((answer, context) => {
    const values = Object.values(answer.probabilities) as number[];
    if (answer.probabilities[answer.choice] !== Math.max(...values)) context.addIssue({ code: "custom", message: "choice not maximum" });
  });
}
const scoreAnswer = z.object({
  type: z.literal("score"), score: z.number().finite().min(0).max(4), confidence: probability,
  probabilities: z.object({ "0": probability, "1": probability, "2": probability, "3": probability, "4": probability }).strict().refine(normalized),
  legend: z.object({ "0": z.unknown(), "1": z.unknown(), "2": z.unknown(), "3": z.unknown(), "4": z.unknown() }).strict(),
}).strict();
const setupResponse = z.object({
  model: z.string().min(1),
  usage: z.object({ input_tokens: z.number().int().nonnegative(), output_tokens: z.number().int().nonnegative() }).strict(),
  answers: z.object({
    abundance: choiceAnswer(["scarce", "balanced", "rich"]), distribution: choiceAnswer(["clustered", "scattered", "seasonal"]), hazard: choiceAnswer(["drought", "toxin", "heat", "crowding"]), volatility: choiceAnswer(["stable", "pulsing", "chaotic"]),
    balance: choiceAnswer(["prey_heavy", "balanced", "predator_heavy"]), diversity: choiceAnswer(["focused", "varied"]), preyStrategy: choiceAnswer(PREY_STRATEGIES), predatorStrategy: choiceAnswer(PREDATOR_STRATEGIES), speciesCount: choiceAnswer(["two", "three", "four"]),
    roleA: choiceAnswer(TROPHIC_ROLES), roleB: choiceAnswer(TROPHIC_ROLES), roleC: choiceAnswer(TROPHIC_ROLES), roleD: choiceAnswer(TROPHIC_ROLES), selfA: choiceAnswer(SELF_INTERACTIONS), selfB: choiceAnswer(SELF_INTERACTIONS), selfC: choiceAnswer(SELF_INTERACTIONS), selfD: choiceAnswer(SELF_INTERACTIONS),
    pairAB: choiceAnswer(PAIR_INTERACTIONS), pairAC: choiceAnswer(PAIR_INTERACTIONS), pairAD: choiceAnswer(PAIR_INTERACTIONS), pairBC: choiceAnswer(PAIR_INTERACTIONS), pairBD: choiceAnswer(PAIR_INTERACTIONS), pairCD: choiceAnswer(PAIR_INTERACTIONS),
    regeneration: choiceAnswer(REGENERATION_MODES), rulePressure: choiceAnswer(RULE_PRESSURES), ruleIntensity: choiceAnswer(RULE_INTENSITIES), ruleDuration: choiceAnswer(DURATIONS),
    survive: scoreAnswer, replicate: scoreAnswer, cooperate: scoreAnswer, explore: scoreAnswer, adapt: scoreAnswer,
  }).strict(),
}).passthrough();

type SetupAnswersResponse = z.infer<typeof setupResponse>["answers"];
type SetupClient = { systemOne(request: { state: SetupAnswers; questions: typeof setupQuestions }): Promise<unknown> };
const slotIds = ["A", "B", "C", "D"] as const;
const pairQuestion = { "A:B": "pairAB", "A:C": "pairAC", "A:D": "pairAD", "B:C": "pairBC", "B:D": "pairBD", "C:D": "pairCD" } as const;
function buildRuleGraph(answers: SetupAnswersResponse): WorldRuleGraph {
  const count = answers.speciesCount.choice === "two" ? 2 : answers.speciesCount.choice === "three" ? 3 : 4;
  const roleAnswers = [answers.roleA, answers.roleB, answers.roleC, answers.roleD];
  const selfAnswers = [answers.selfA, answers.selfB, answers.selfC, answers.selfD];
  const species = slotIds.slice(0, count).map((id, index) => ({ id, role: roleAnswers[index].choice, selfInteraction: selfAnswers[index].choice }));
  const interactions: WorldRuleGraph["interactions"] = [];
  for (let left = 0; left < count; left += 1) for (let right = left + 1; right < count; right += 1) {
    const pair = `${slotIds[left]}:${slotIds[right]}` as SpeciesPair;
    interactions.push({ pair, mode: answers[pairQuestion[pair]].choice });
  }
  return validateRuleGraph({ version: 1, species, interactions, environment: { regeneration: answers.regeneration.choice, pressure: answers.rulePressure.choice, volatility: answers.volatility.choice, intensity: answers.ruleIntensity.choice, duration: answers.ruleDuration.choice } });
}

export async function interpretSetup(input: SetupRequest, options: { apiKey?: string; client?: SetupClient } = {}): Promise<SetupInterpretation> {
  const requestHash = hashSetupRequest(input.answers);
  const fallback = (): SetupInterpretation => ({ config: deterministicSetup(input.answers), source: "fallback", requestHash });
  if (input.requestHash !== requestHash) return fallback();
  const apiKey = options.apiKey ?? process.env.TYPESAFE_API_KEY;
  if (!apiKey) return fallback();
  try {
    const client = options.client ?? new TypeSafeClient({ apiKey, timeout: 5000, retry: { maxRetries: 1 } });
    const parsed = setupResponse.parse(await client.systemOne({ state: input.answers, questions: setupQuestions }));
    const answers = parsed.answers;
    const scores = [answers.survive, answers.replicate, answers.cooperate, answers.explore, answers.adapt];
    if (scores.some((item) => Math.abs(item.score - Object.entries(item.probabilities).reduce((sum, [level, value]) => sum + Number(level) * value, 0)) > 0.051)) return fallback();
    const config = lifeConfigSchema.parse({
      environment: { abundance: answers.abundance.choice, distribution: answers.distribution.choice, hazard: answers.hazard.choice, volatility: answers.volatility.choice },
      founders: { balance: answers.balance.choice, diversity: answers.diversity.choice, preyStrategy: answers.preyStrategy.choice, predatorStrategy: answers.predatorStrategy.choice },
      fitness: normalizeFitness({ survive: answers.survive.score, replicate: answers.replicate.score, cooperate: answers.cooperate.score, explore: answers.explore.score, adapt: answers.adapt.score }),
      rules: buildRuleGraph(answers),
    });
    return { config, source: "jev", requestHash, model: parsed.model, usage: parsed.usage, evidence: structuredClone(answers) as Record<string, unknown> };
  } catch {
    return fallback();
  }
}

const evolutionQuestions = {
  preyStrategy: choice("Choose the heritable strategy applied only to subsequent basal-consumer births.", criteria(PREY_STRATEGIES)), predatorStrategy: choice("Choose the heritable strategy applied only to subsequent hunter births.", criteria(PREDATOR_STRATEGIES)), preyMutationTarget: choice("Choose the bounded basal-consumer germline mutation target.", criteria(MUTATION_TARGETS)), preyMutationTempo: choice("Choose basal-consumer germline mutation tempo.", criteria(MUTATION_TEMPOS)), predatorMutationTarget: choice("Choose hunter germline mutation target.", criteria(MUTATION_TARGETS)), predatorMutationTempo: choice("Choose hunter germline mutation tempo.", criteria(MUTATION_TEMPOS)), environmentPressure: choice("Choose the next bounded environmental law.", criteria(ENVIRONMENT_PRESSURES)), environmentIntensity: choice("Choose its bounded intensity.", criteria(INTENSITIES)), ruleActivation: choice("Choose when this environmental law activates from the frozen ecology: now, after a bounded delay, or at a bounded ecological event.", criteria(ACTIVATIONS)), ruleDuration: choice("Choose how long the environmental law remains active.", criteria(DURATIONS)), ruleTransition: choice("Choose whether activation is abrupt, gradual, or pulsed.", criteria(TRANSITIONS)),
};
const evolutionResponse = z.object({ model: z.string().min(1), usage: z.object({ input_tokens: z.number().int().nonnegative(), output_tokens: z.number().int().nonnegative() }).strict(), answers: z.object({ preyStrategy: choiceAnswer(PREY_STRATEGIES), predatorStrategy: choiceAnswer(PREDATOR_STRATEGIES), preyMutationTarget: choiceAnswer(MUTATION_TARGETS), preyMutationTempo: choiceAnswer(MUTATION_TEMPOS), predatorMutationTarget: choiceAnswer(MUTATION_TARGETS), predatorMutationTempo: choiceAnswer(MUTATION_TEMPOS), environmentPressure: choiceAnswer(ENVIRONMENT_PRESSURES), environmentIntensity: choiceAnswer(INTENSITIES), ruleActivation: choiceAnswer(ACTIVATIONS), ruleDuration: choiceAnswer(DURATIONS), ruleTransition: choiceAnswer(TRANSITIONS) }).strict() }).passthrough();
type EvolutionClient = { systemOne(request: { state: EcologySummary; questions: typeof evolutionQuestions }): Promise<unknown> };
export async function decideEvolution(input: { kind: "evolution"; summary: EcologySummary }, options: { apiKey?: string; client?: EvolutionClient } = {}): Promise<EvolutionDecision> {
  const fallback = () => deterministicEvolutionDecision(input.summary);
  const apiKey = options.apiKey ?? process.env.TYPESAFE_API_KEY;
  if (!apiKey) return fallback();
  try {
    const client = options.client ?? new TypeSafeClient({ apiKey, timeout: 5000, retry: { maxRetries: 1 } });
    const parsed = evolutionResponse.parse(await client.systemOne({ state: input.summary, questions: evolutionQuestions }));
    const strip = (answer: { type: "choice" } & Record<string, unknown>) => { const { type: ignored, ...rest } = answer; void ignored; return rest; };
    const { ruleActivation, ruleDuration, ruleTransition, ...mechanics } = parsed.answers;
    return validateEvolutionDecision({ generation: input.summary.generation, trigger: input.summary.trigger, observationHash: fallback().observationHash, source: "jev", model: parsed.model, usage: parsed.usage, ruleGraphVersion: input.summary.rules?.version??1, scheduledRuleChange: { decidedAtGeneration: input.summary.generation, activation: ruleActivation.choice, duration: ruleDuration.choice, transition: ruleTransition.choice, patch: { kind: "environment", field: "pressure", value: mechanics.environmentPressure.choice } }, ruleActivation: strip(ruleActivation), ruleDuration: strip(ruleDuration), ruleTransition: strip(ruleTransition), ...Object.fromEntries(Object.entries(mechanics).map(([key, value]) => [key, strip(value)])) });
  } catch {
    return fallback();
  }
}
