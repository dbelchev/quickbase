import { z } from "zod";

export const optimizationIterationSchema = z.object({
  round: z.number().int().nonnegative(),
  roundScore: z.number(),
  bestScore: z.number(),
  instructions: z.string(),
  trainingPasses: z.number().int().nonnegative().nullable(),
  trainingTotal: z.number().int().nonnegative(),
  holdoutGates: z.array(z.number().int().nonnegative()),
  gate: z.enum(["pending", "pass", "fail"]),
});

export type OptimizationIteration = z.infer<typeof optimizationIterationSchema>;
