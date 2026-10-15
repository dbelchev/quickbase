import { z } from "zod";

export const exampleSplitSchema = z.object({
  split: z.enum(["train", "holdout"]),
});

export type ExampleSplit = z.infer<typeof exampleSplitSchema>;

export function parseExampleSplits<Example extends ExampleSplit>(
  examples: readonly Example[],
): readonly Example[] {
  z.array(exampleSplitSchema).parse(examples);
  return examples;
}
