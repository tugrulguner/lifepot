import { z } from "zod";

export const SETUP_REVIEW_FOCI = ["species_count", "trophic_roles", "feeding_links", "unsupported_mechanics", "ambiguous_food_web", "general"] as const;
export const SETUP_REVIEW_QUESTIONS: Record<typeof SETUP_REVIEW_FOCI[number], string> = {
 species_count: "Which two to four species should this world contain? Confirm their names in the description.",
 trophic_roles: "Which species feed on resources, and which must eat other species? Confirm those roles.",
 feeding_links: "Who eats whom? Confirm each feeding direction using the species names.",
 unsupported_mechanics: "This engine supports resource feeding, directed consumption and bounded pressures, not arbitrary biological processes. Would a world using those mechanics represent your idea?",
 ambiguous_food_web: "Should these organisms eat one another, compete without feeding, or remain unrelated? Specify the intended relationships.",
 general: "Review the proposed species and feeding links below. If they differ from your idea, edit only the affected answer; your original answers are retained.",
};
export const setupNamedIntentSchema = z.object({ species: z.array(z.object({ id: z.enum(["A", "B", "C", "D"]), name: z.string().min(1).max(140), role: z.enum(["producer", "grazer", "hunter", "scavenger", "omnivore"]) })).min(2).max(4) });
export type SetupNamedIntent = z.infer<typeof setupNamedIntentSchema>;
export const setupFailureSchema = z.object({
 stage: z.enum(["initial_interpretation", "intent_mapping", "intent_roles", "intent_pairs", "initial_council", "fidelity_review", "repair_roles", "repair_pairs", "repair_fidelity", "repair_council", "review_focus"]),
 code: z.enum(["rate_limited", "unavailable", "invalid_response", "missing_credentials", "unknown"]),
}).strict();
export type SetupFailure = z.infer<typeof setupFailureSchema>;
export const setupFidelitySchema = z.object({
 verdict: z.enum(["approve", "reselect", "reject", "needs_clarification"]),
 model: z.string().min(1),
 usage: z.object({ input_tokens: z.number().int().nonnegative(), output_tokens: z.number().int().nonnegative() }).strict(),
 repairAttempted: z.boolean().optional(),
 failure: setupFailureSchema.optional(),
 repairFailure: z.enum(["rate_limited", "unavailable", "invalid_response", "missing_credentials", "unknown"]).optional(),
 focus: z.enum(SETUP_REVIEW_FOCI).optional(),
 mismatches: z.array(z.string().max(500)).max(16).optional(),
}).strict();
export type SetupFidelity = z.infer<typeof setupFidelitySchema>;
