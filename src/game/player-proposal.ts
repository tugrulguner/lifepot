import { z } from "zod";
import { ENVIRONMENT_PRESSURES, type EnvironmentRules } from "./rules";

export type PlayerProposal = {
  version: 1;
  source: "jev";
  model: string;
  usage: { input_tokens: number; output_tokens: number };
  pressure: EnvironmentRules['pressure'];
  duration: 6;
  evidence: { choice: string; confidence: number; probabilities: Record<string, number> };
};

export const playerProposalSchema = z.object({
  version: z.literal(1), source: z.literal("jev"), model: z.string().min(1).max(100),
  usage: z.object({ input_tokens: z.number().int().nonnegative(), output_tokens: z.number().int().nonnegative() }).strict(),
  pressure: z.enum(ENVIRONMENT_PRESSURES), duration: z.literal(6),
  evidence: z.object({ choice: z.string().min(1).max(40), confidence: z.number().min(0).max(1), probabilities: z.record(z.string(), z.number().min(0).max(1)) }).strict(),
}).strict();

export function validatePlayerProposal(input: unknown): PlayerProposal {
  const parsed = playerProposalSchema.parse(input);
  const keys = Object.keys(parsed.evidence.probabilities);
  const expected = ["unsupported", ...ENVIRONMENT_PRESSURES];
  if (keys.length !== expected.length || expected.some((key) => !keys.includes(key))) throw new Error("Invalid player proposal probability palette");
  const probabilities = parsed.evidence.probabilities;
  const total = Object.values(probabilities).reduce((sum, value) => sum + value, 0);
  if (Math.abs(total - 1) > 0.011) throw new Error("Invalid player proposal probability total");
  const selected = parsed.evidence.choice;
  if (!(expected as string[]).includes(selected) || parsed.pressure !== selected || probabilities[selected] !== Math.max(...Object.values(probabilities))) throw new Error("Invalid player proposal choice");
  return parsed as PlayerProposal;
}

export const playerEventSchema = z.object({
  actor:z.literal('player'), acceptedGeneration:z.number().int().min(0).max(179),
  generation:z.number().int().min(1).max(180),ruleGraphVersion:z.number().int().min(1),
  worldFingerprint:z.string().regex(/^world_[a-f0-9]{64}$/),
  previousPressure:z.enum(ENVIRONMENT_PRESSURES),proposal:playerProposalSchema,
}).strict();
export type AcceptedPlayerEvent=z.infer<typeof playerEventSchema>;
export function validatePlayerEvents(input:unknown):AcceptedPlayerEvent[]{
 const events=z.array(playerEventSchema).max(8).parse(input);
 for(let i=0;i<events.length;i++){
  const event=events[i];validatePlayerProposal(event.proposal);
  if(event.generation!==event.acceptedGeneration+1||event.previousPressure===event.proposal.pressure)throw new Error('Invalid player event boundary or no-op');
  if(i>0&&event.acceptedGeneration<events[i-1].generation+6)throw new Error('Overlapping or reordered player events');
 }
 return structuredClone(events);
}
