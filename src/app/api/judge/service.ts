import { choice, score, TypeSafeClient } from "@typesafe-ai/sdk";
import { z } from "zod";
import { deterministicSetup, hashSetupRequest, lifeConfigSchema, normalizeFitness, type SetupAnswers } from "@/game/setup";
import type { LifeConfig } from "@/game/world";
import type { SetupRequest } from "./schema";

type JevUsage = { input_tokens: number; output_tokens: number };
export type SetupInterpretation = { config: LifeConfig; source: "jev" | "fallback"; requestHash: string; model?: string; usage?: JevUsage };
const questions = {
  abundance: choice("How abundant are usable resources inside the resource-bearing locations described by `world`? Judge explicit resource amount words such as scarce, rich, abundant, or plentiful. A small number of locations (for example, 'a few rich oases') describes distribution and must not by itself make resources scarce.", { scarce: "Resources themselves are rare or limited", balanced: "Resource amount is moderate or unspecified", rich: "Resources themselves are plentiful, rich, or abundant" }),
  distribution: choice("How are resources distributed in `world`?", { clustered: "Concentrated in patches or oases", scattered: "Spread across the habitat", seasonal: "Availability shifts in recurring seasons" }),
  hazard: choice("Which supported hazard best matches `threat`?", { drought: "Resource loss or lack of water", toxin: "Poison, contamination, or toxic exposure", heat: "High temperature or fire", crowding: "Overpopulation or local competition", predator: "Hunters or predators pursue exposed life" }),
  volatility: choice("How does the threat change over time?", { stable: "Mostly constant", pulsing: "Recurring waves or cycles", chaotic: "Irregular and unpredictable" }),
  survive: score("How strongly does `reward` prioritize staying alive?", ["Not mentioned", "Minor", "Moderate", "Strong", "Primary"]),
  replicate: score("How strongly does `reward` prioritize reproduction?", ["Not mentioned", "Minor", "Moderate", "Strong", "Primary"]),
  cooperate: score("How strongly does `reward` prioritize cooperation?", ["Not mentioned", "Minor", "Moderate", "Strong", "Primary"]),
  explore: score("How strongly does `reward` prioritize exploration?", ["Not mentioned", "Minor", "Moderate", "Strong", "Primary"]),
  adapt: score("How strongly does `reward` prioritize adaptation?", ["Not mentioned", "Minor", "Moderate", "Strong", "Primary"]),
};
const probability = z.number().finite().min(0).max(1);
const sumsToOne = (value: Record<string, number>) => Math.abs(Object.values(value).reduce((sum, item) => sum + item, 0) - 1) <= 1e-6;
function choiceAnswer<const T extends readonly [string, ...string[]]>(options: T) {
  const probabilities = z.record(z.enum(options), probability).refine((value) => Object.keys(value).length === options.length && sumsToOne(value), "Invalid choice probabilities");
  return z.object({ type: z.literal("choice"), choice: z.enum(options), confidence: probability, probabilities }).strict();
}
const scoreAnswer = z.object({ type: z.literal("score"), score: z.number().finite().min(0).max(4), confidence: probability,
  probabilities: z.object({ "0": probability, "1": probability, "2": probability, "3": probability, "4": probability }).strict().refine(sumsToOne),
  legend: z.object({ "0": z.unknown(), "1": z.unknown(), "2": z.unknown(), "3": z.unknown(), "4": z.unknown() }).strict(),
}).strict();
const responseSchema = z.object({ model: z.string(), usage: z.object({ input_tokens: z.number().int().nonnegative(), output_tokens: z.number().int().nonnegative() }).strict(), answers: z.object({
  abundance: choiceAnswer(["scarce", "balanced", "rich"]), distribution: choiceAnswer(["clustered", "scattered", "seasonal"]), hazard: choiceAnswer(["drought", "toxin", "heat", "crowding", "predator"]), volatility: choiceAnswer(["stable", "pulsing", "chaotic"]),
  survive: scoreAnswer, replicate: scoreAnswer, cooperate: scoreAnswer, explore: scoreAnswer, adapt: scoreAnswer,
}).strict() }).passthrough();
type SystemOneLike = { systemOne(request: { state: SetupAnswers; questions: typeof questions }): Promise<unknown> };

export async function interpretSetup(input: SetupRequest, options: { apiKey?: string; client?: SystemOneLike } = {}): Promise<SetupInterpretation> {
  const answers = input.answers; const requestHash = hashSetupRequest(answers);
  const fallback = (): SetupInterpretation => ({ config: deterministicSetup(answers), source: "fallback", requestHash });
  if (input.requestHash !== requestHash) return fallback();
  const apiKey = options.apiKey ?? process.env.TYPESAFE_API_KEY; if (!apiKey) return fallback();
  try {
    const client = options.client ?? new TypeSafeClient({ apiKey, timeout: 5000, retry: { maxRetries: 1 } });
    const parsed = responseSchema.safeParse(await client.systemOne({ state: answers, questions }));
    if (!parsed.success) {
      if (process.env.NODE_ENV !== "production") console.error("[LifePot Jev] invalid response", parsed.error.issues.map(({ path, message }) => ({ path, message })));
      return fallback();
    }
    const value = parsed.data.answers;
    const choices: Array<{ choice: string; probabilities: Record<string, number> }> = [value.abundance, value.distribution, value.hazard, value.volatility];
    if (choices.some((answer) => answer.probabilities[answer.choice] !== Math.max(...Object.values(answer.probabilities)))) {
      if (process.env.NODE_ENV !== "production") console.error("[LifePot Jev] selected choice was not the maximum-probability option");
      return fallback();
    }
    const scores = [value.survive, value.replicate, value.cooperate, value.explore, value.adapt];
    const scoreDifferences = scores.map((answer) => Math.abs(answer.score - Object.entries(answer.probabilities).reduce((sum, [level, probability]) => sum + Number(level) * probability, 0)));
    // Jev rounds both scores and individual probabilities for transport. Their
    // independently rounded values may differ by a few hundredths.
    if (scoreDifferences.some((difference) => difference > 0.051)) {
      if (process.env.NODE_ENV !== "production") console.error("[LifePot Jev] score did not match its probability-weighted value");
      return fallback();
    }
    const config = lifeConfigSchema.parse({ environment: { abundance: value.abundance.choice, distribution: value.distribution.choice, hazard: value.hazard.choice, volatility: value.volatility.choice }, fitness: normalizeFitness({ survive: value.survive.score, replicate: value.replicate.score, cooperate: value.cooperate.score, explore: value.explore.score, adapt: value.adapt.score }) });
    return { config, source: "jev", requestHash, model: parsed.data.model, usage: parsed.data.usage };
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("[LifePot Jev] request failed", error instanceof Error ? error.message : "unknown error");
    return fallback();
  }
}
