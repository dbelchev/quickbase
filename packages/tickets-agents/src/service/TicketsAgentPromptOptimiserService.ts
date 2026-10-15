import { type FireworksService } from "@quickbase/inference-provider";
import {
  createServices as createOptimizationServices,
  recordOptimization,
  type OptimizationReport,
} from "@quickbase/prompt-optimization";
import { type LabeledRow } from "../labeledRows";
import { ticketsChatModelId } from "./TicketsAgentService";
import { TicketsAgentScorerService } from "./TicketsAgentScorerService";

const judgeModelId = "accounts/fireworks/models/minimax-m3";

// Optimizes the tickets chat agent's base instructions against the labeled
// rows. The Fireworks inference provider is injected so each scored turn uses
// the same model resolution as the chat agent.

export class TicketsAgentPromptOptimiserService {
  constructor(
    private readonly fireworks: FireworksService,
    private readonly rows: readonly LabeledRow[],
  ) {}

  async optimize({
    apiKey,
    instructions,
    resultsPath,
  }: {
    apiKey: string;
    instructions: string;
    resultsPath: string;
  }): Promise<OptimizationReport> {
    const scorer = new TicketsAgentScorerService(this.fireworks, this.rows);
    const { modelFactory, optimizeInstructions } = createOptimizationServices();

    const student = modelFactory.create({
      providerName: "fireworks",
      apiKey,
      config: { model: ticketsChatModelId },
    });

    const judge = modelFactory.create({
      providerName: "fireworks",
      apiKey,
      config: { model: judgeModelId, maxTokens: 8192 },
    });

    return recordOptimization(optimizeInstructions, {
      resultsPath,
      studentModelId: student.modelId,
      judgeModelId: judge.modelId,
    }).optimize(
      { instructions, examples: scorer.labeledRows() },
      { scoreExample: scorer.scoreExample, student, judge },
    );
  }
}
