import {
  parseExampleSplits,
  type ExampleSplit,
  type ScoreExample,
  scoreInstructionsInputSchema,
  type ScoreInstructionsInput,
  type ScoreRecord,
} from "../model";

export class ScoreInstructionsService {
  async score<Example extends ExampleSplit, Trace>(
    input: ScoreInstructionsInput & { examples: readonly Example[] },
    scoreExample: ScoreExample<Example, Trace>,
  ): Promise<ScoreRecord> {
    const { instructions } = scoreInstructionsInputSchema.parse(input);
    const examples = parseExampleSplits(input.examples);
    let trainingPasses = 0;
    let trainingTotal = 0;
    let holdoutPasses = 0;
    let holdoutTotal = 0;

    for (const example of examples) {
      const { passed } = await scoreExample(instructions, example);
      if (example.split === "train") {
        trainingTotal += 1;
        if (passed) trainingPasses += 1;
      } else {
        holdoutTotal += 1;
        if (passed) holdoutPasses += 1;
      }
    }

    return {
      instructions,
      trainingPasses,
      trainingTotal,
      holdoutPasses,
      holdoutTotal,
    };
  }
}
