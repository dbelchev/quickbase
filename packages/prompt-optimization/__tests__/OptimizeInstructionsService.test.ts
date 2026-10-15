import type { AxAIService } from "@ax-llm/ax";
import { ZodError } from "zod";
import { describe, expect, it, vi } from "vitest";
import { createServices } from "../src";

describe("OptimizeInstructionsService", () => {
  it("rejects a bad search setting before scoring", async () => {
    const { optimizeInstructions } = createServices();
    const scoreExample = vi.fn();

    await expect(
      optimizeInstructions.optimize(
        {
          instructions: "be brief",
          examples: [{ split: "train" }],
          trialCount: 0,
        },
        {
          scoreExample,
          student: {} as AxAIService,
          judge: {} as AxAIService,
        },
      ),
    ).rejects.toThrow(ZodError);
    expect(scoreExample).not.toHaveBeenCalled();
  });
});
