import { FireworksService } from "@quickbase/inference-provider";
import { MockLanguageModelV4, simulateReadableStream } from "ai/test";
import { expect, it } from "vitest";
import { labeledRows } from "../src/labeledRows";
import { TicketsAgentScorerService } from "../src/service/TicketsAgentScorerService";

const modelId = "accounts/fireworks/models/gpt-oss-120b";

const usage = {
  inputTokens: {
    total: 1,
    noCache: 1,
    cacheRead: 0,
    cacheWrite: 0,
  },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};

function labeledRow(number: number) {
  const row = labeledRows.find((item) => item.number === number);
  if (!row) throw new Error(`missing labeled row ${number}`);
  return row;
}

type ModelStream = Awaited<ReturnType<MockLanguageModelV4["doStream"]>>;

function finish(reason: "stop" | "tool-calls") {
  return {
    type: "finish" as const,
    finishReason: { unified: reason, raw: undefined },
    usage,
  };
}

function textStream(text: string): ModelStream {
  return {
    stream: simulateReadableStream({
      chunks: [
        { type: "stream-start", warnings: [] },
        { type: "response-metadata", id: "response-1" },
        { type: "text-start", id: "text-1" },
        { type: "text-delta", id: "text-1", delta: text },
        { type: "text-end", id: "text-1" },
        finish("stop"),
      ],
    }),
  };
}

function toolCallStream(toolName: string, input: unknown): ModelStream {
  return {
    stream: simulateReadableStream({
      chunks: [
        { type: "stream-start", warnings: [] },
        { type: "response-metadata", id: "response-1" },
        {
          type: "tool-call",
          toolCallId: "call-1",
          toolName,
          input: JSON.stringify(input),
        },
        finish("tool-calls"),
      ],
    }),
  };
}

function mockFireworks(streams: ModelStream[]) {
  let index = 0;
  const model = new MockLanguageModelV4({
    modelId,
    doStream: async () => {
      const stream = streams[index];
      index += 1;
      if (!stream) throw new Error("unexpected model call");
      return stream;
    },
  });
  return { model, fireworks: new FireworksService(() => model) };
}

it("scores a search through the live turn when the query returns the gold ids", async () => {
  const instructions = "Score only this candidate prompt.";
  const { model, fireworks } = mockFireworks([
    toolCallStream("search_tickets", { query: "" }),
    textStream("Listed."),
  ]);

  const turn = await new TicketsAgentScorerService(fireworks, labeledRows).runLabeledTurn(
    instructions,
    labeledRow(1),
  );

  expect(turn.passed).toBe(true);
  expect(turn.toolCalls).toEqual([
    { toolName: "search_tickets", input: { query: "" } },
  ]);
  expect(turn.replyText).toBe("Listed.");
  expect(JSON.stringify(model.doStreamCalls[0]?.prompt)).toContain(instructions);
});

it("scores a delete through the live turn when the proposal matches the gold", async () => {
  const { fireworks } = mockFireworks([
    toolCallStream("mutate_ticket", { id: "1", action: "delete" }),
  ]);

  const turn = await new TicketsAgentScorerService(fireworks, labeledRows).runLabeledTurn(
    "candidate",
    labeledRow(12),
  );

  expect(turn.passed).toBe(true);
  expect(turn.toolCalls).toEqual([
    {
      toolName: "mutate_ticket",
      input: { id: "1", action: "delete" },
    },
  ]);
});

it("scores a refusal through the live turn when the reply is the exact sentence", async () => {
  const { fireworks } = mockFireworks([
    textStream(TicketsAgentScorerService.refusalSentence),
  ]);

  const turn = await new TicketsAgentScorerService(fireworks, labeledRows).runLabeledTurn(
    "candidate",
    labeledRow(21),
  );

  expect(turn.passed).toBe(true);
  expect(turn.toolCalls).toEqual([]);
  expect(turn.replyText).toBe(TicketsAgentScorerService.refusalSentence);
});
