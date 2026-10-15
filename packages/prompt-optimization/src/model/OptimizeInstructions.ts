import { z } from "zod";

const defaultTrialCount = 8;
const defaultMinibatchSize = 8;
const defaultMaxMetricCalls = 120;
const defaultSeed = 42;
const defaultHoldoutGateRuns = 3;

export const optimizeInstructionsInputSchema = z.object({
  instructions: z.string(),
  trialCount: z.number().int().positive().default(defaultTrialCount),
  minibatchSize: z.number().int().positive().default(defaultMinibatchSize),
  maxMetricCalls: z.number().int().positive().default(defaultMaxMetricCalls),
  seed: z.number().int().default(defaultSeed),
  holdoutGateRuns: z.number().int().positive().default(defaultHoldoutGateRuns),
});

export type OptimizeInstructionsInput = z.infer<
  typeof optimizeInstructionsInputSchema
>;
