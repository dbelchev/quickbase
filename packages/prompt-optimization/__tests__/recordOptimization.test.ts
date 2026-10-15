import type { AxAIService } from "@ax-llm/ax";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  recordOptimization,
  type OptimizationReport,
  type OptimizeInstructionsService,
} from "../src";

const baseline = {
  instructions: "be brief",
  trainingPasses: 1,
  trainingTotal: 2,
  holdoutPasses: 1,
  holdoutTotal: 1,
};

const progress: OptimizationReport = {
  ranAt: "2026-10-15T00:00:00.000Z",
  baseline,
  lastIteration: {
    round: 1,
    roundScore: 0.5,
    bestScore: 0.5,
    instructions: "be briefer",
    trainingPasses: null,
    trainingTotal: 2,
    holdoutGates: [],
    gate: "pending",
  },
};

const finished: OptimizationReport = {
  ...progress,
  lastIteration: {
    ...progress.lastIteration,
    instructions: "winning",
    trainingPasses: 2,
    holdoutGates: [1, 1],
    gate: "pass",
  },
};

const groundedBaseline = {
  instructions: "original",
  trainingPasses: 3,
  trainingTotal: 4,
  holdoutPasses: 1,
  holdoutTotal: 2,
};

describe("recordOptimization", () => {
  const directories: string[] = [];
  const log = vi.spyOn(console, "log").mockImplementation(() => {});

  afterEach(async () => {
    log.mockClear();
    await Promise.all(
      directories
        .splice(0)
        .map((directory) => rm(directory, { recursive: true })),
    );
  });

  it("writes progress, then the finished report with a saved grounded baseline", async () => {
    const resultsPath = await resultsFile({
      groundedBaseline,
      baseline,
    });

    const seen: OptimizationReport[] = [];
    const report = await optimizeRecorded(
      async (onProgress) => {
        onProgress?.(progress);
        await vi.waitFor(async () => {
          expect(await readReport(resultsPath)).toMatchObject({
            studentModelId: "student",
            judgeModelId: "judge",
            groundedBaseline,
            lastIteration: { gate: "pending", instructions: "be briefer" },
          });
        });
        return finished;
      },
      resultsPath,
      (snapshot) => {
        seen.push(snapshot);
      },
    );

    expect(report).toBe(finished);
    expect(seen).toEqual([progress]);
    expect(await readReport(resultsPath)).toEqual({
      ranAt: finished.ranAt,
      studentModelId: "student",
      judgeModelId: "judge",
      groundedBaseline,
      baseline,
      lastIteration: finished.lastIteration,
    });
    expect(log.mock.calls.map((call) => call[0])).toEqual([
      "baseline training score 1/2",
      "baseline holdout score 1/1",
      "candidate training score 2/2",
      "--- winning instructions ---",
      "winning",
      "--- end winning instructions ---",
      "holdout gate 1 1/1",
      "holdout gate 2 1/1",
      "gate pass",
    ]);
  });

  it("omits a missing or invalid grounded baseline", async () => {
    const missingPath = await resultsFile();
    await optimizeRecorded(async () => finished, missingPath);
    expect(await readReport(missingPath)).not.toHaveProperty("groundedBaseline");

    const invalidPath = await resultsFile({
      groundedBaseline: { instructions: 1 },
    });
    await optimizeRecorded(
      async () => ({
        ...finished,
        lastIteration: { ...finished.lastIteration, gate: "fail" },
      }),
      invalidPath,
    );
    expect(await readReport(invalidPath)).not.toHaveProperty("groundedBaseline");
    expect(log.mock.calls.at(-1)).toEqual(["gate fail"]);
  });

  it("propagates an optimize failure without logging a summary", async () => {
    const resultsPath = await resultsFile();

    await expect(
      optimizeRecorded(async () => {
        throw new Error("score failed");
      }, resultsPath),
    ).rejects.toThrow("score failed");
    expect(log).not.toHaveBeenCalled();
  });

  async function resultsFile(contents?: unknown) {
    const directory = await mkdtemp(join(tmpdir(), "optimization-report-"));
    directories.push(directory);
    const resultsPath = join(directory, "optimization-results.json");
    if (contents !== undefined) {
      await writeFile(resultsPath, JSON.stringify(contents));
    }
    return resultsPath;
  }
});

function optimizeRecorded(
  run: (
    onProgress: ((report: OptimizationReport) => void) | undefined,
  ) => Promise<OptimizationReport>,
  resultsPath: string,
  onProgress?: (report: OptimizationReport) => void,
) {
  const optimizeInstructions: Pick<OptimizeInstructionsService, "optimize"> = {
    async optimize(_input, options) {
      return run(options.onProgress);
    },
  };
  return recordOptimization(optimizeInstructions, {
    resultsPath,
    studentModelId: "student",
    judgeModelId: "judge",
  }).optimize(
    { instructions: "be brief", examples: [{ split: "train" }] },
    {
      scoreExample: async () => ({ passed: true, trace: {} }),
      student: {} as AxAIService,
      judge: {} as AxAIService,
      onProgress,
    },
  );
}

async function readReport(resultsPath: string) {
  return JSON.parse(await readFile(resultsPath, "utf8")) as unknown;
}
