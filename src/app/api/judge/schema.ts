import { z } from "zod";
import { setupAnswersSchema } from "@/game/setup";
export const setupRequestSchema = z.object({ answers: setupAnswersSchema, requestHash: z.string().min(1).max(64).regex(/^setup_[A-Za-z0-9]+$/) }).strict();
export type SetupRequest = z.infer<typeof setupRequestSchema>;
