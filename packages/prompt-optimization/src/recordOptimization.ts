import { readFile, writeFile } from "node:fs/promises";
import {
  scoreRecordSchema,
  type OptimizationReport,
  type ScoreRecord,
} from "./model";
import type { OptimizeInstructionsService } from "./service";

export function recordOptimization(
  optimizeInstructions: Pick<OptimizeInstructionsService, "optimize">,
  {
    resultsPath,
    studentModelId,
    judgeModelId,
  }: {
    resultsPath: string;
    studentModelId: string;
    judgeModelId: string;
  },
): Pick<OptimizeInstructionsService, "optimize"> {
  const optimize: OptimizeInstructionsService["optimize"] = async (
    input,
    options,
  ) => {
    const groundedBaseline = await readGroundedBaseline(resultsPath);
    let queuedWrite = Promise.resolve();
    const writeReport = (report: OptimizationReport): Promise<void> => {
      const body = `${JSON.stringify(
        savedReport(report, { studentModelId, judgeModelId, groundedBaseline }),
        null,
        2,
      )}\n`;
      queuedWrite = queuedWrite.then(() => writeFile(resultsPath, body));
      return queuedWrite;
    };

    const report = await optimizeInstructions.optimize(input, {
      ...options,
      onProgress: (progress) => {
        void writeReport(progress);
        options.onProgress?.(progress);
      },
    });
    logReport(report);
    await writeReport(report);
    return report;
  };

  return { optimize };
}

function savedReport(
  report: OptimizationReport,
  {
    studentModelId,
    judgeModelId,
    groundedBaseline,
  }: {
    studentModelId: string;
    judgeModelId: string;
    groundedBaseline: ScoreRecord | undefined;
  },
) {
  return {
    ranAt: report.ranAt,
    studentModelId,
    judgeModelId,
    ...(groundedBaseline ? { groundedBaseline } : {}),
    baseline: report.baseline,
    lastIteration: report.lastIteration,
  };
}

async function readGroundedBaseline(
  resultsPath: string,
): Promise<ScoreRecord | undefined> {
  try {
    const parsed = JSON.parse(await readFile(resultsPath, "utf8")) as {
      groundedBaseline?: unknown;
    };
    const saved = scoreRecordSchema.safeParse(parsed.groundedBaseline);
    return saved.success ? saved.data : undefined;
  } catch {
    return undefined;
  }
}

function logReport(report: OptimizationReport) {
  const iteration = report.lastIteration;
  console.log(
    `baseline training score ${report.baseline.trainingPasses}/${report.baseline.trainingTotal}`,
  );
  console.log(
    `baseline holdout score ${report.baseline.holdoutPasses}/${report.baseline.holdoutTotal}`,
  );
  console.log(
    `candidate training score ${iteration.trainingPasses}/${iteration.trainingTotal}`,
  );
  console.log("--- winning instructions ---");
  console.log(iteration.instructions);
  console.log("--- end winning instructions ---");
  for (const [index, passes] of iteration.holdoutGates.entries()) {
    console.log(
      `holdout gate ${index + 1} ${passes}/${report.baseline.holdoutTotal}`,
    );
  }
  console.log(iteration.gate === "pass" ? "gate pass" : "gate fail");
}
