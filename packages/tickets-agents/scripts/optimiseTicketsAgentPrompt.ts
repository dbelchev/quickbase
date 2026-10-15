import { fileURLToPath } from "node:url";
import { createFireworksService } from "@quickbase/inference-provider";
import { labeledRows } from "../src/labeledRows";
import { ticketsAgentBaseSystemPrompt as instructions } from "../src/model";
import { TicketsAgentPromptOptimiserService } from "../src/service/TicketsAgentPromptOptimiserService";

const resultsPath = fileURLToPath(
  new URL("../optimization-results.json", import.meta.url),
);

await main();

async function main() {
  const apiKey = process.env.FIREWORKS_TEST_API_KEY;
  if (!apiKey?.trim()) {
    console.error(
      "FIREWORKS_TEST_API_KEY is required to resolve a Fireworks model.",
    );
    process.exitCode = 1;
    return;
  }

  const fireworks = createFireworksService();
  await new TicketsAgentPromptOptimiserService(fireworks, labeledRows).optimize({
    apiKey,
    instructions,
    resultsPath,
  });
}
