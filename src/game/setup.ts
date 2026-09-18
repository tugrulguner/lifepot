import { z } from "zod";
import type { FitnessConfig, LifeConfig } from "./world";

const answer = z.string().trim().min(1).max(140);
export const setupAnswersSchema = z.object({ world: answer, threat: answer, reward: answer }).strict();
export type SetupAnswers = z.infer<typeof setupAnswersSchema>;
export const environmentSchema = z.object({
  abundance: z.enum(["scarce", "balanced", "rich"]), distribution: z.enum(["clustered", "scattered", "seasonal"]),
  hazard: z.enum(["drought", "toxin", "heat", "crowding", "predator"]), volatility: z.enum(["stable", "pulsing", "chaotic"]),
}).strict();
export const fitnessSchema = z.object({ survive: z.number().min(0).max(1), replicate: z.number().min(0).max(1), cooperate: z.number().min(0).max(1), explore: z.number().min(0).max(1), adapt: z.number().min(0).max(1) }).strict()
  .refine((value) => Math.abs(Object.values(value).reduce((sum, item) => sum + item, 0) - 1) < 1e-9, "Fitness weights must sum to one");
export const lifeConfigSchema = z.object({ environment: environmentSchema, fitness: fitnessSchema }).strict();

export function canonicalAnswers(answers: SetupAnswers): SetupAnswers {
  return setupAnswersSchema.parse({ world: answers.world.trim(), threat: answers.threat.trim(), reward: answers.reward.trim() });
}
function fnv1a(text: string): string { let hash = 0x811c9dc5; for (let i = 0; i < text.length; i += 1) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 0x01000193); } return (hash >>> 0).toString(36); }
export function hashSetupRequest(input: SetupAnswers): string { const value = canonicalAnswers(input); return `setup_${fnv1a(JSON.stringify([value.world, value.threat, value.reward]))}`; }
export function hashReplayPayload(value: unknown): string { return `replay_${fnv1a(JSON.stringify(value))}`; }
export function normalizeFitness(raw: FitnessConfig): FitnessConfig {
  const keys = ["survive", "replicate", "cooperate", "explore", "adapt"] as const;
  const bounded = keys.map((key) => Math.max(0, Number.isFinite(raw[key]) ? raw[key] : 0));
  const total = bounded.reduce((sum, value) => sum + value, 0) || keys.length;
  const firstFour = bounded.slice(0, 4).map((value) => value / total);
  const overflow = Math.max(0, firstFour.reduce((sum, value) => sum + value, 0) - 1);
  if (overflow) firstFour[3] -= overflow;
  return { survive: firstFour[0], replicate: firstFour[1], cooperate: firstFour[2], explore: firstFour[3], adapt: 1 - firstFour.reduce((sum, value) => sum + value, 0) };
}
export function defaultConfig(): LifeConfig { return { environment: { abundance: "balanced", distribution: "scattered", hazard: "drought", volatility: "stable" }, fitness: { survive: 0.2, replicate: 0.2, cooperate: 0.2, explore: 0.2, adapt: 0.2 } }; }

function includes(text: string, words: string[]): boolean { return words.some((word) => text.includes(word)); }
export function deterministicSetup(answersInput: SetupAnswers): LifeConfig {
  const answers = canonicalAnswers(answersInput); const world = answers.world.toLowerCase(); const threat = answers.threat.toLowerCase(); const reward = answers.reward.toLowerCase();
  const abundance = includes(world, ["rich", "abundant", "plenty", "lush"]) ? "rich" : includes(world, ["scarce", "little", "few", "limited", "barren"]) ? "scarce" : "balanced";
  const distribution = includes(world, ["cluster", "oasis", "patch"]) ? "clustered" : includes(world, ["season", "cycle"]) ? "seasonal" : "scattered";
  const hazard = includes(threat, ["predator", "hunter", "hunt", "prey"]) ? "predator" : includes(threat, ["toxin", "toxic", "poison"]) ? "toxin" : includes(threat, ["heat", "hot", "fire"]) ? "heat" : includes(threat, ["crowd", "overpopulation", "competition"]) ? "crowding" : "drought";
  const volatility = includes(threat, ["chaos", "unpredict", "random"]) ? "chaotic" : includes(threat, ["pulse", "wave", "period", "storm", "recurr", "pack"]) ? "pulsing" : "stable";
  const raw: FitnessConfig = { survive: 1, replicate: 1, cooperate: 1, explore: 1, adapt: 1 };
  if (/surviv|endure|resilien/.test(reward)) raw.survive += 4;
  if (/reproduc|replic|multiply|offspring/.test(reward)) raw.replicate += 4;
  if (/cooper|share|help|group/.test(reward)) raw.cooperate += 4;
  if (/explor|discover|spread|move/.test(reward)) raw.explore += 4;
  if (/adapt|mutat|change|evolve/.test(reward)) raw.adapt += 4;
  return { environment: { abundance, distribution, hazard, volatility }, fitness: normalizeFitness(raw) };
}
