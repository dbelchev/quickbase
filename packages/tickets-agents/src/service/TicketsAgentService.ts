import {
  FireworksService,
  type FireworksModelId,
} from "@quickbase/inference-provider";
import {
  isStepCount,
  streamText,
  tool,
  type ModelMessage,
  type ToolSet,
} from "ai";
import {
  mutateTicketInputSchema,
  searchTicketsInputSchema,
  tenantIdSchema,
  type IncomingMessage,
  type ReplyInput,
  type ReplyObservers,
  type ReplyResult,
  type TenantId,
  ticketsAgentDecisionSystemPrompt as decisionSystemPrompt,
} from "../model";
import type { TicketRepository } from "../repository";
import type { ProposalService } from "./ProposalService";
import type { ThreadService } from "./ThreadService";

export const ticketsChatModelId =
  "accounts/fireworks/models/gpt-oss-120b" satisfies FireworksModelId;

export class TicketsAgentService {
  constructor(
    private readonly repository: TicketRepository,
    private readonly proposals: ProposalService,
    private readonly threads: ThreadService,
    private readonly fireworks: FireworksService,
    private readonly baseInstructions: string,
  ) {}

  reset(): void {
    this.repository.reset();
    this.proposals.reset();
    this.threads.reset();
  }

  async reply(
    input: ReplyInput,
    observers?: ReplyObservers,
  ): Promise<ReplyResult> {
    const tenantId = tenantIdSchema.parse(input.tenantId);
    if (this.threads.bind(tenantId, input.threadId) === "mismatch") {
      return { outcome: "mismatch" };
    }

    const messages = stripApprovalParts(input.messages);
    const recorded = input.confirmationProposalId
      ? this.proposals.recordedDecision(tenantId, input.confirmationProposalId)
      : null;
    const confirmation =
      recorded && input.confirmationProposalId
        ? {
            proposalId: input.confirmationProposalId,
            outcome: recorded.outcome,
          }
        : undefined;

    const response = await this.runTurn(
      {
        tenantId,
        threadId: input.threadId,
        messages,
        confirmation,
      },
      observers,
    );
    return { outcome: "response", response };
  }

  private async runTurn(
    input: {
      tenantId: TenantId;
      threadId: string;
      messages: unknown[];
      confirmation?: { proposalId: string; outcome: "applied" | "rejected" };
    },
    observers?: ReplyObservers,
  ): Promise<Response> {
    const canPropose = !input.confirmation;
    const text = lastUserText(input.messages);
    const decision = decisionSystemPrompt(input.confirmation);
    const history = this.threads.messages(input.threadId);
    const messages: ModelMessage[] = text
      ? [...history, { role: "user", content: text }]
      : [...history];
    if (messages.length === 0) {
      return Response.json({ error: "Missing message." }, { status: 400 });
    }

    const result = streamText({
      model: this.fireworks.languageModel(ticketsChatModelId),
      instructions: [
        { role: "system", content: this.baseInstructions },
        ...(decision ? [{ role: "system" as const, content: decision }] : []),
      ],
      messages,
      tools: this.ticketTools(input.tenantId, canPropose),
      stopWhen: [
        isStepCount(5),
        ({ steps }) =>
          steps.some((step) =>
            step.toolResults.some((toolResult) => {
              const output = toolResult.output as
                | { outcome?: string }
                | undefined;
              return output?.outcome === "pending";
            }),
          ),
      ],
      onLanguageModelCallStart(event) {
        observers?.onModelCall?.({
          modelId: event.modelId,
          messages: event.messages,
        });
      },
      onStepEnd(event) {
        observers?.onToolResults?.(
          event.toolResults.map((toolResult) => toolResult.output),
        );
      },
      onEnd: (event) => {
        this.threads.setMessages(input.threadId, [
          ...messages,
          ...event.responseMessages,
        ]);
        observers?.onTurn?.({
          replyText: event.text,
          toolCalls: event.toolCalls.map((call) => ({
            toolName: call.toolName,
            input: call.input,
            ...(call.invalid ? { invalid: true } : {}),
          })),
        });
      },
    });

    return result.toUIMessageStreamResponse();
  }

  private ticketTools(tenantId: TenantId, canPropose: boolean): ToolSet {
    const search_tickets = tool({
      description:
        "Search the current tenant's tickets. Every word in the query must appear in the title or description, in any order, ignoring letter case. An empty query or * lists every ticket. Returns id, title, description, and status. Does not accept a tenant argument.",
      inputSchema: searchTicketsInputSchema,
      execute: async ({ query }) => this.repository.search(tenantId, query),
    });

    const tools: ToolSet = { search_tickets };
    if (!canPropose) return tools;

    tools.mutate_ticket = tool({
      description:
        "Propose updating or deleting a ticket the current tenant owns. This never writes. Update fields may only include title, description, and status.",
      inputSchema: mutateTicketInputSchema,
      execute: async ({ id, action, fields }) =>
        this.proposals.propose({ tenantId, id, action, fields }),
    });
    return tools;
  }
}

function lastUserText(messages: unknown[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message || typeof message !== "object") continue;
    const record = message as IncomingMessage;
    if (record.role !== "user" || !Array.isArray(record.parts)) continue;
    return record.parts
      .filter((part) => part.type === "text" && part.text)
      .map((part) => part.text)
      .join("");
  }
  return "";
}

function stripApprovalParts(messages: unknown[]): unknown[] {
  return messages.map((message) => {
    if (!message || typeof message !== "object") return message;
    const record = message as IncomingMessage;
    if (!Array.isArray(record.parts)) return message;
    return {
      ...record,
      parts: record.parts.filter((part) => !part.type?.includes("approval")),
    };
  });
}
