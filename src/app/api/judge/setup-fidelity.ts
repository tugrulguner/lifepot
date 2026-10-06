import { choice, type TypeSafeClient } from "@typesafe-ai/sdk";
import { z } from "zod";
import type { SetupAnswers } from "@/game/setup";
import { type WorldRuleGraph } from "@/game/rules";

const verdicts = ["approve", "reselect", "reject", "needs_clarification"] as const;
const responseSchema = z.object({
  model: z.string().min(1),
  usage: z.object({ input_tokens: z.number().int().nonnegative(), output_tokens: z.number().int().nonnegative() }).strict(),
  answers: z.object({ verdict: z.object({ type: z.literal("choice"), choice: z.enum(verdicts), confidence: z.number().min(0).max(1), probabilities: z.record(z.enum(verdicts), z.number().min(0).max(1)) }).strict() }).strict(),
}).passthrough();
export type SetupFidelityResult = { verdict: typeof verdicts[number]; model: string; usage: { input_tokens: number; output_tokens: number } };
type FidelityClient = Pick<TypeSafeClient, "systemOne">;
export async function reviewSetupFidelity(answers: SetupAnswers, graph: WorldRuleGraph, client: FidelityClient, beforeCall?: () => Promise<void>): Promise<SetupFidelityResult> {
  await beforeCall?.();
  const result = responseSchema.parse(await client.systemOne({ state: { original_prose: answers, assembled_graph: graph }, questions: { verdict: choice("Compare the assembled frozen graph jointly with the original user prose. Assess distinct species count, trophic roles, and named pair relationships. Do not infer intent from keyword rules. Approve only if faithfully represented; otherwise reselect if a supported graph can correct it, reject or request clarification when the prose is ambiguous. This review cannot change the graph.", { approve: "Faithful", reselect: "Mismatch but safely correctable", reject: "Mismatch; reject setup", needs_clarification: "Ambiguous; ask user" }) } } as never));
  const { choice: verdict, probabilities } = result.answers.verdict;
  if (Math.abs(Object.values(probabilities).reduce((a, b) => a + b, 0) - 1) > .011 || probabilities[verdict] !== Math.max(...Object.values(probabilities))) throw new Error("Invalid setup fidelity response");
  return { verdict, model: result.model, usage: result.usage };
}
