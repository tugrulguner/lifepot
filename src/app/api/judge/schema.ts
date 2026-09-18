import { z } from "zod";
import { COHORT_IDS, DECISION_EPOCHS } from "@/game/decisions";
import { lifeConfigSchema, setupAnswersSchema } from "@/game/setup";

export const setupRequestSchema = z.object({ answers: setupAnswersSchema, requestHash: z.string().min(1).max(64).regex(/^setup_[A-Za-z0-9]+$/) }).strict();
export type SetupRequest = z.infer<typeof setupRequestSchema>;

const finite = z.number().finite();
const cohortSummarySchema = z.object({
  id: z.enum(COHORT_IDS), count: z.number().int().nonnegative(), meanEnergy: finite, meanLocalPressure: finite,
  meanResource: finite, meanHazard: finite, meanTraits: z.tuple([finite, finite, finite, finite, finite]),
}).strict();
export const epochRequestSchema = z.object({
  kind: z.literal("epoch"),
  summary: z.object({
    generation: z.union(DECISION_EPOCHS.map((epoch) => z.literal(epoch)) as unknown as [z.ZodLiteral<number>, z.ZodLiteral<number>, ...z.ZodLiteral<number>[]]),
    intent: setupAnswersSchema,
    environment: lifeConfigSchema.shape.environment,
    fitness: lifeConfigSchema.shape.fitness,
    world: z.object({ population: z.number().int().nonnegative(), births: z.number().int().nonnegative(), deaths: z.number().int().nonnegative(), meanEnergy: finite, meanResource: finite, meanHazard: finite }).strict(),
    cohorts: z.array(cohortSummarySchema).length(COHORT_IDS.length).superRefine((cohorts, context) => {
      if (cohorts.some((cohort, index) => cohort.id !== COHORT_IDS[index])) context.addIssue({ code: "custom", message: "Cohorts must be complete and canonical" });
    }),
  }).strict(),
}).strict();
export type EpochRequest = z.infer<typeof epochRequestSchema>;
