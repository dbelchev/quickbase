import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createFireworksService } from "@quickbase/inference-provider";
import {
  createServices,
  scoreRecordSchema,
  type ScoreRecord,
} from "@quickbase/prompt-optimization";
import { labeledRows } from "../src/labeledRows";
import { ticketsAgentBaseSystemPrompt } from "../src/model";
import { ticketsChatModelId } from "../src/service/TicketsAgentService";
import { TicketsAgentScorerService } from "../src/service/TicketsAgentScorerService";

const resultsPath = fileURLToPath(
  new URL("../optimization-results.json", import.meta.url),
);

await main();

async function main() {
  if (!process.env.FIREWORKS_TEST_API_KEY?.trim()) {
    console.error(
      "FIREWORKS_TEST_API_KEY is required to resolve a Fireworks model.",
    );
    process.exitCode = 1;
    return;
  }

  const fireworks = createFireworksService();
  const scorer = new TicketsAgentScorerService(fireworks, labeledRows);
  const { scoreInstructions } = createServices();
  const scored = await scoreInstructions.score(
    {
      instructions: ticketsAgentBaseSystemPrompt,
      examples: scorer.labeledRows(),
    },
    scorer.scoreExample,
  );
  console.log(
    `training score ${scored.trainingPasses}/${scored.trainingTotal}`,
  );
  console.log(`holdout score ${scored.holdoutPasses}/${scored.holdoutTotal}`);

  const groundedBaseline = (await readGroundedBaseline()) ?? scored;
  await writeFile(
    resultsPath,
    `${JSON.stringify(
      {
        ranAt: new Date().toISOString(),
        studentModelId: ticketsChatModelId,
        groundedBaseline,
        baseline: scored,
      },
      null,
      2,
    )}\n`,
  );
}

async function readGroundedBaseline(): Promise<ScoreRecord | undefined> {
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
