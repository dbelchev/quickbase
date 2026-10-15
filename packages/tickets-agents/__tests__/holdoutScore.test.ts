import { createFireworksService } from "@quickbase/inference-provider";
import { createServices } from "@quickbase/prompt-optimization";
import { expect, it } from "vitest";
import { labeledRows } from "../src/labeledRows";
import { ticketsAgentBaseSystemPrompt } from "../src/model";
import { TicketsAgentScorerService } from "../src/service/TicketsAgentScorerService";

it(
  "scores the current base instructions 12 of 12 on the holdout rows",
  async () => {
    if (!process.env.FIREWORKS_TEST_API_KEY?.trim()) {
      throw new Error("FIREWORKS_TEST_API_KEY is missing");
    }

    const fireworks = createFireworksService();
    const scorer = new TicketsAgentScorerService(fireworks, labeledRows);
    const { scoreInstructions } = createServices();
    const score = await scoreInstructions.score(
      {
        instructions: ticketsAgentBaseSystemPrompt,
        examples: scorer.holdoutRows(),
      },
      scorer.scoreExample,
    );

    expect(score.holdoutPasses).toBe(12);
    expect(score.holdoutTotal).toBe(12);
  },
  600_000,
);
