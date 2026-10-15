import { ZodError } from "zod";
import { describe, expect, it, vi } from "vitest";
import { ScoreInstructionsService } from "../src";

describe("ScoreInstructionsService", () => {
  it("counts training and holdout passes and keeps the caller's example fields", async () => {
    const examples = [
      { split: "train", id: 1 },
      { split: "train", id: 2 },
      { split: "holdout", id: 3 },
    ] as const;
    const scoreExample = vi.fn(
      async (_instructions: string, example: (typeof examples)[number]) => ({
        passed: example.id !== 2,
        trace: { id: example.id },
      }),
    );

    const score = await new ScoreInstructionsService().score(
      { instructions: "be brief", examples },
      scoreExample,
    );

    expect(score).toEqual({
      instructions: "be brief",
      trainingPasses: 1,
      trainingTotal: 2,
      holdoutPasses: 1,
      holdoutTotal: 1,
    });
    expect(scoreExample.mock.calls.map((call) => call[1])).toEqual([
      examples[0],
      examples[1],
      examples[2],
    ]);
  });

  it("rejects a bad split before scoring", async () => {
    const scoreExample = vi.fn();

    await expect(
      new ScoreInstructionsService().score(
        {
          instructions: "be brief",
          examples: [{ split: "other" as "train" }],
        },
        scoreExample,
      ),
    ).rejects.toThrow(ZodError);
    expect(scoreExample).not.toHaveBeenCalled();
  });
});
