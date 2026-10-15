import { z } from "zod";
import type { ExampleSplit } from "./ExampleSplit";

export const scoreInstructionsInputSchema = z.object({
  instructions: z.string(),
});

export type ScoreInstructionsInput = z.infer<
  typeof scoreInstructionsInputSchema
>;

export type ScoreExample<Example extends ExampleSplit, Trace> = (
  instructions: string,
  example: Example,
) => Promise<{ passed: boolean; trace: Trace }>;
