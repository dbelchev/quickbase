import { z } from "zod";
import { optimizationIterationSchema } from "./OptimizationIteration";
import { scoreRecordSchema } from "./ScoreRecord";

export const optimizationReportSchema = z.object({
  ranAt: z.string(),
  baseline: scoreRecordSchema,
  lastIteration: optimizationIterationSchema,
});

export type OptimizationReport = z.infer<typeof optimizationReportSchema>;
