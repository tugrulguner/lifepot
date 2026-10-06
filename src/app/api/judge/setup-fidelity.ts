import { choice, type TypeSafeClient } from "@typesafe-ai/sdk";
import { z } from "zod";
import type { SetupAnswers } from "@/game/setup";
import type { LifeConfig } from "@/game/world";

import { SETUP_REVIEW_FOCI, type SetupFidelity } from "@/game/setup-review";

const verdicts = ["approve", "reselect", "reject", "needs_clarification"] as const;
const responseSchema = z.object({
  model: z.string().min(1),
  usage: z.object({ input_tokens: z.number().int().nonnegative(), output_tokens: z.number().int().nonnegative() }).strict(),
  answers: z.object({ verdict: z.object({ type: z.literal("choice"), choice: z.enum(verdicts), confidence: z.number().min(0).max(1), probabilities: z.record(z.enum(verdicts), z.number().min(0).max(1)) }).strict() }).strict(),
}).passthrough();
export type SetupFidelityResult = SetupFidelity;
type FidelityClient = Pick<TypeSafeClient, "systemOne">;
function readableFoodWeb(config: LifeConfig) {
 return {
  species: (config.rules?.species ?? []).map(s => `${s.id}: ${s.role}`),
  relationships: (config.rules?.interactions ?? []).map(edge => {
   const [a,b] = edge.pair.split(":");
   return edge.mode === "a_consumes_b" ? `${a} consumes ${b}` : edge.mode === "b_consumes_a" ? `${b} consumes ${a}` : `${a} and ${b}: ${edge.mode} (no consumption)`;
  }),
 };
}
export async function selectSetupReviewFocus(answers: SetupAnswers, config: LifeConfig, client: FidelityClient, beforeCall?: () => Promise<void>) {
 await beforeCall?.();
 const parsed = responseSchema.extend({ answers: z.object({ focus: responseSchema.shape.answers.shape.verdict.extend({ choice: z.enum(SETUP_REVIEW_FOCI), probabilities: z.record(z.enum(SETUP_REVIEW_FOCI), z.number().min(0).max(1)) }) }).strict() }).parse(await client.systemOne({
  state: { original_prose: answers, interpreted_config: config, assembled_graph: config.rules, readable_food_web: readableFoodWeb(config) },
  questions: { focus: choice("Choose the single most useful area for player review of this unresolved interpretation. This is a suggested review focus, not proof of a mismatch or a request to rewrite everything. Use general if no specific issue can be identified.", { species_count: "Names or number of species", trophic_roles: "Basal feeding versus hunting roles", feeding_links: "Direction of named consumption links", unsupported_mechanics: "Requested mechanics beyond the supported engine", ambiguous_food_web: "Relationships need an explicit choice", general: "No specific mismatch identified" }) },
 } as never));
 const answer = parsed.answers.focus;
 if (Object.keys(answer.probabilities).length !== SETUP_REVIEW_FOCI.length || Math.abs(Object.values(answer.probabilities).reduce((a,b) => a+b,0)-1) > .011 || answer.probabilities[answer.choice] !== Math.max(...Object.values(answer.probabilities))) throw new Error("Invalid setup review focus");
 return { focus: answer.choice, usage: parsed.usage };
}
export async function reviewSetupFidelity(answers: SetupAnswers, config: LifeConfig, client: FidelityClient, beforeCall?: () => Promise<void>): Promise<SetupFidelityResult> {
  await beforeCall?.();
  const result = responseSchema.parse(await client.systemOne({ state: { original_prose: answers, interpreted_config: config, assembled_graph: config.rules, readable_food_web: readableFoodWeb(config) }, questions: { verdict: choice("Review FOOD-WEB FIDELITY, not realism or whether the user's objective will succeed. Compare the original_prose with readable_food_web and assembled_graph. Slots A/B/C/D follow first-mentioned organisms; explicit slot names are literal. Every pair names its own first and second endpoints: b_consumes_a in B:C means C eats B, NOT B eats C. The readable relationships decode the actual engine behavior. Producer is a bounded basal resource feeder; grazer may eat another species when a consumption edge exists. Biological chemistry is not simulated and its absence is not a food-web mismatch. Environment and reward settings exist in interpreted_config outside the graph. Do not demand extra detail about unspecified settings or treat desired coexistence as a promise of survival. Approve when named species roles and requested feeding directions match. Reselect only for a concrete mismatch that changing this food web can correct. Request clarification only when a required relationship truly cannot be determined; reject only an unsupported demand with no faithful bounded representation. You cannot change the graph in this review.", { approve: "Supported food-web intent is faithfully represented", reselect: "Correct the proposal: species, roles or feeding directions conflict with clear requested intent", reject: "Unsupported requested mechanics cannot be represented by the supported palette", needs_clarification: "Essential food-web intent is ambiguous; preserve the answers and ask for clarification" }) } } as never));
  const { choice: verdict, probabilities } = result.answers.verdict;
  if (Math.abs(Object.values(probabilities).reduce((a, b) => a + b, 0) - 1) > .011 || probabilities[verdict] !== Math.max(...Object.values(probabilities))) throw new Error("Invalid setup fidelity response");
  return { verdict, model: result.model, usage: result.usage };
}
