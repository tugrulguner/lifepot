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
export const setupFidelitySchema = z.object({
 verdict: z.enum(["approve", "reselect", "reject", "needs_clarification"]),
 model: z.string().min(1),
 usage: z.object({ input_tokens: z.number().int().nonnegative(), output_tokens: z.number().int().nonnegative() }).strict(),
 repairAttempted: z.boolean().optional(),
 repairFailure: z.enum(["rate_limited", "unavailable", "invalid_response", "missing_credentials", "unknown"]).optional(),
 focus: z.enum(SETUP_REVIEW_FOCI).optional(),
}).strict();
export type SetupFidelity = z.infer<typeof setupFidelitySchema>;
