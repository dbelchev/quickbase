import {
  ax,
  AxGEPA,
  type AxAIService,
  type AxGEPAAdapter,
  type AxOptimizerLoggerData,
} from "@ax-llm/ax";
import { z } from "zod";
import {
  optimizeInstructionsInputSchema,
  parseExampleSplits,
  type ExampleSplit,
  type OptimizationReport,
  type ScoreExample,
} from "../model";
import type { ScoreInstructionsService } from "./ScoreInstructionsService";

const instructionProgramId = "instructions";

export class OptimizeInstructionsService {
  constructor(private readonly scoreInstructions: ScoreInstructionsService) {}

  async optimize<
    Example extends ExampleSplit,
    Trace extends Record<string, unknown>,
  >(
    input: z.input<typeof optimizeInstructionsInputSchema> & {
      examples: readonly Example[];
    },
    {
      scoreExample,
      student,
      judge,
      onProgress,
    }: {
      scoreExample: ScoreExample<Example, Trace>;
      student: AxAIService;
      judge: AxAIService;
      onProgress?: (report: OptimizationReport) => void;
    },
  ): Promise<OptimizationReport> {
    const settings = optimizeInstructionsInputSchema.parse(input);
    const examples = parseExampleSplits(input.examples);
    const training = examples.filter((example) => example.split === "train");
    const holdout = examples.filter((example) => example.split === "holdout");
    const baseline = await this.scoreInstructions.score(
      {
        instructions: settings.instructions,
        examples: [...training, ...holdout],
      },
      scoreExample,
    );
    const ranAt = new Date().toISOString();
    const { program, instructionKey } = instructionProgram(settings.instructions);
    let latestInstructions = settings.instructions;
    let scorerFailure: { error: unknown } | undefined;
    let lastRound: number | undefined;

    const adapter: AxGEPAAdapter<{ example: Example }, undefined, Trace> = {
      async evaluate(batch, candidate) {
        const candidateInstructions = candidate[instructionKey];
        latestInstructions =
          typeof candidateInstructions === "string"
            ? candidateInstructions
            : settings.instructions;
        const outputs: Trace[] = [];
        const scores: number[] = [];
        for (const { example } of batch) {
          if (scorerFailure) return { outputs, scores };
          try {
            const result = await scoreExample(latestInstructions, example);
            outputs.push(result.trace);
            scores.push(result.passed ? 1 : 0);
          } catch (error) {
            scorerFailure ??= { error };
            return { outputs, scores };
          }
        }
        return { outputs, scores };
      },
      make_reflective_dataset(_candidate, evalBatch, componentsToUpdate) {
        const rows = evalBatch.outputs.map((trace, index) => ({
          ...trace,
          score: evalBatch.scores[index] ?? 0,
        }));
        return Object.fromEntries(
          componentsToUpdate.map((key) => [key, rows]),
        );
      },
    };

    const optimizerArgs = {
      studentAI: student,
      teacherAI: judge,
      numTrials: settings.trialCount,
      minibatch: true,
      minibatchSize: settings.minibatchSize,
      earlyStoppingTrials: settings.trialCount,
      sampleCount: 1,
      seed: settings.seed,
      verbose: true,
      paretoSetSize: training.length,
      optimizerLogger: (event: AxOptimizerLoggerData) => {
        if (scorerFailure) throw scorerFailure.error;
        if (event.name !== "RoundProgress") return;
        lastRound = event.value.round;
        onProgress?.({
          ranAt,
          baseline,
          lastIteration: {
            round: event.value.round,
            roundScore: event.value.currentScore,
            bestScore: event.value.bestScore,
            instructions: latestInstructions,
            trainingPasses: null,
            trainingTotal: training.length,
            holdoutGates: [],
            gate: "pending",
          },
        });
      },
    } satisfies ConstructorParameters<typeof AxGEPA>[0] & {
      paretoSetSize: number;
    };

    let result: Awaited<ReturnType<AxGEPA["compile"]>>;
    try {
      result = await new AxGEPA(optimizerArgs).compile(
        program,
        training.map((example) => ({ example })),
        async () => {
          const error = new Error(
            "The search scores each example through the GEPA adapter.",
          );
          scorerFailure ??= { error };
          throw error;
        },
        {
          maxMetricCalls: settings.maxMetricCalls,
          bootstrap: false,
          verbose: true,
          gepaAdapter: adapter,
        },
      );
    } catch (error) {
      throw scorerFailure?.error ?? error;
    }
    if (scorerFailure) throw scorerFailure.error;

    const winning =
      result.optimizedProgram?.componentMap?.[instructionKey] ??
      settings.instructions;
    const candidateTraining = Math.round(result.bestScore * training.length);
    const meetsTrainingBaseline = candidateTraining >= baseline.trainingPasses;
    const holdoutGates = meetsTrainingBaseline
      ? await this.holdoutGate({
          instructions: winning,
          holdout,
          scoreExample,
          runs: settings.holdoutGateRuns,
        })
      : [];
    const gate =
      meetsTrainingBaseline &&
      holdoutGates.length === settings.holdoutGateRuns &&
      holdoutGates.every((passes) => passes === holdout.length)
        ? "pass"
        : "fail";

    return {
      ranAt,
      baseline,
      lastIteration: {
        round: lastRound ?? result.optimizedProgram?.totalRounds ?? 0,
        roundScore: result.bestScore,
        bestScore: result.bestScore,
        instructions: winning,
        trainingPasses: candidateTraining,
        trainingTotal: training.length,
        holdoutGates,
        gate,
      },
    };
  }

  private async holdoutGate<
    Example extends ExampleSplit,
    Trace extends Record<string, unknown>,
  >({
    instructions,
    holdout,
    scoreExample,
    runs,
  }: {
    instructions: string;
    holdout: readonly Example[];
    scoreExample: ScoreExample<Example, Trace>;
    runs: number;
  }): Promise<number[]> {
    const passes: number[] = [];
    for (let run = 0; run < runs; run += 1) {
      const scored = await this.scoreInstructions.score(
        { instructions, examples: holdout },
        scoreExample,
      );
      passes.push(scored.holdoutPasses);
    }
    return passes;
  }
}

function instructionProgram(instructions: string) {
  const program = ax("example:json -> reply:string");
  program.setId(instructionProgramId);
  program.setInstruction(instructions);
  const components = program.getOptimizableComponents();
  const instruction = components.find(
    (component) => component.kind === "instruction",
  );
  if (
    components.length !== 1 ||
    instruction?.key !== `${instructionProgramId}::instruction`
  ) {
    throw new Error("The search can change only the one instruction string.");
  }
  return { program, instructionKey: instruction.key };
}
