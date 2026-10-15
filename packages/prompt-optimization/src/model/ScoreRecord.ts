import { z } from "zod";

export const scoreRecordSchema = z.object({
  instructions: z.string(),
  trainingPasses: z.number().int().nonnegative(),
  trainingTotal: z.number().int().nonnegative(),
  holdoutPasses: z.number().int().nonnegative(),
  holdoutTotal: z.number().int().nonnegative(),
});

export type ScoreRecord = z.infer<typeof scoreRecordSchema>;
