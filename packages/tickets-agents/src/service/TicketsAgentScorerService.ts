import { createServices as createDatabase } from "@quickbase/database";
import { type FireworksService } from "@quickbase/inference-provider";
import { isDeepStrictEqual } from "node:util";
import { createServices } from "../createServices";
import { type LabeledRow } from "../labeledRows";
import { type ObservedCall } from "../model";
import type { TicketRepository } from "../repository";

// Scores candidate system prompts by running each labeled user message through
// TicketsAgentService.reply. The store and the prompt are injected per row.
// The grade looks at tool calls (and, for refusals, the exact reply), not at
// how the model phrases a successful search or mutation.

export type LabeledTurn = {
  passed: boolean;
  toolCalls: ObservedCall[];
  replyText: string;
};

export class TicketsAgentScorerService {
  static readonly refusalSentence =
    "I can't help you with this query. You can list, update or delete tickets. Let me know how I can help";

  // Written into failed traces so the optimizer's judge grades the same way this class does.
  private static readonly scoringRules = [
    `A refusal passes only when there are no tool calls and the trimmed reply equals exactly: ${TicketsAgentScorerService.refusalSentence}`,
    "A search passes when the last search_tickets call returns the gold ids. Earlier searches may narrow the query.",
    "An update or delete passes when the last mutate_ticket call matches the gold. A search before it is allowed.",
    "The reply text is not scored for a search, update, or delete.",
  ].join("\n");

  constructor(
    private readonly fireworks: FireworksService,
    private readonly rows: readonly LabeledRow[],
  ) {}

  /**
   * One example for the prompt optimizer. Returns pass/fail plus a trace the
   * judge can read: the user text, the gold label, what the model called, and
   * a miss reason when the row failed.
   */
  scoreExample = async (instructions: string, row: LabeledRow) => {
    let turn: LabeledTurn;
    try {
      turn = await this.runLabeledTurn(instructions, row);
    } catch (error) {
      console.error(`row ${row.number} stopped the run`);
      throw error;
    }
    console.log(
      `${row.number} ${row.split} ${turn.passed ? "pass" : "fail"} ${row.text}`,
    );

    return {
      passed: turn.passed,
      trace: {
        userText: row.text,
        gold: row.gold,
        toolCalls: turn.toolCalls,
        replyText: turn.replyText,
        scoringRules: TicketsAgentScorerService.scoringRules,
        ...(turn.passed
          ? {}
          : {
              miss: this.explainFailure(row, turn.toolCalls, turn.replyText),
            }),
      },
    };
  };

  /** The labeled set this scorer grades, in set order. */
  labeledRows(): readonly LabeledRow[] {
    return this.rows;
  }

  /**
   * Run the candidate instructions through the live agent on one user message.
   * A new seeded store is injected for the row, so proposals cannot leak.
   */
  async runLabeledTurn(
    instructions: string,
    row: LabeledRow,
  ): Promise<LabeledTurn> {
    const { database } = createDatabase();
    const { tickets, ticketsChatAgent } = createServices(
      database,
      this.fireworks,
      instructions,
    );
    let turn: { toolCalls: ObservedCall[]; replyText: string } | undefined;
    const reply = await ticketsChatAgent.reply(
      {
        tenantId: "tenant-a",
        threadId: `labeled-${row.number}`,
        messages: [{ role: "user", parts: [{ type: "text", text: row.text }] }],
      },
      {
        onTurn(completed) {
          turn = completed;
        },
      },
    );
    if (reply.outcome !== "response") {
      throw new Error(`row ${row.number} did not get a model response`);
    }
    await reply.response.text();
    if (!turn) {
      throw new Error(`row ${row.number} finished without a turn`);
    }
    return {
      passed: this.passes(row, turn.toolCalls, turn.replyText, tickets),
      toolCalls: turn.toolCalls,
      replyText: turn.replyText,
    };
  }

  /** Rows the optimizer may rewrite the prompt against. */
  trainingRows(): LabeledRow[] {
    return this.rows.filter((row) => row.split === "train");
  }

  /** Rows held back so a prompt that memorizes the training set still has to generalize. */
  holdoutRows(): LabeledRow[] {
    return this.rows.filter((row) => row.split === "holdout");
  }

  /** One-line reason a row failed, attached to the optimizer trace as `miss`. */
  explainFailure(
    row: LabeledRow,
    toolCalls: ObservedCall[],
    _text: string,
  ): string {
    if (row.gold.kind === "refusal") {
      if (toolCalls.length > 0) {
        return "Called a tool. A refusal must call nothing and use the exact sentence in the scoring rules.";
      }
      return "The reply was not the exact refusal sentence in the scoring rules.";
    }
    const call = this.gradedCall(row, toolCalls);
    if (!call) {
      return row.gold.kind === "search"
        ? "Expected a search_tickets call."
        : "Expected a mutate_ticket call.";
    }
    if (call.invalid) return "The tool call was invalid.";
    return "The tool call did not match the gold.";
  }

  /**
   * Grade the turn. Refusals need zero tool calls and the exact sentence.
   * Search, update, and delete ignore reply text and grade only the last
   * call of the expected tool.
   */
  private passes(
    row: LabeledRow,
    toolCalls: ObservedCall[],
    text: string,
    tickets: TicketRepository,
  ): boolean {
    if (row.gold.kind === "refusal") {
      return (
        toolCalls.length === 0 &&
        text.trim() === TicketsAgentScorerService.refusalSentence
      );
    }
    const call = this.gradedCall(row, toolCalls);
    if (!call || call.invalid) return false;
    if (row.gold.kind === "search") {
      return this.matchesSearch(call, tickets, row.gold.ids);
    }
    if (row.gold.kind === "update") {
      return this.matchesUpdate(call, row.gold.id, row.gold.fields);
    }
    return this.matchesDelete(call, row.gold.id);
  }

  /**
   * The call that counts. Earlier searches may narrow a query, so only the
   * last search_tickets or mutate_ticket is compared to the gold.
   */
  private gradedCall(
    row: LabeledRow,
    toolCalls: ObservedCall[],
  ): ObservedCall | undefined {
    const toolName =
      row.gold.kind === "search" ? "search_tickets" : "mutate_ticket";
    return toolCalls.findLast((call) => call.toolName === toolName);
  }

  /** Re-run the model's query on the seeded store and compare the id set to gold. */
  private matchesSearch(
    call: ObservedCall,
    tickets: TicketRepository,
    ids: string[],
  ): boolean {
    if (call.toolName !== "search_tickets" || !this.isRecord(call.input)) {
      return false;
    }
    if (typeof call.input.query !== "string") return false;
    const found = tickets
      .search("tenant-a", call.input.query)
      .map((ticket) => ticket.id);
    return this.sameIdSet(found, ids);
  }

  /** Update passes only when id, action, and fields deep-equal the gold. */
  private matchesUpdate(
    call: ObservedCall,
    id: string,
    fields: Record<string, string>,
  ): boolean {
    if (call.toolName !== "mutate_ticket" || !this.isRecord(call.input)) {
      return false;
    }
    return isDeepStrictEqual(
      {
        id: call.input.id,
        action: call.input.action,
        fields: call.input.fields,
      },
      { id, action: "update", fields },
    );
  }

  /** Delete passes on id and action. Missing fields, or an empty fields object, are both fine. */
  private matchesDelete(call: ObservedCall, id: string): boolean {
    if (call.toolName !== "mutate_ticket" || !this.isRecord(call.input)) {
      return false;
    }
    if (call.input.id !== id || call.input.action !== "delete") return false;
    if (!("fields" in call.input) || call.input.fields === undefined)
      return true;
    return (
      this.isRecord(call.input.fields) &&
      Object.keys(call.input.fields).length === 0
    );
  }

  /** Order does not matter; duplicate ids would change the set size and fail. */
  private sameIdSet(actual: string[], expected: string[]): boolean {
    const actualIds = new Set(actual);
    const expectedIds = new Set(expected);
    if (actualIds.size !== expectedIds.size) return false;
    for (const id of actualIds) {
      if (!expectedIds.has(id)) return false;
    }
    return true;
  }

  /** Tool inputs arrive as unknown; graders only compare plain objects. */
  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
}
