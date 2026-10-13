import { MockLanguageModelV4 } from "ai/test";
import { ZodError } from "zod";
import { describe, expect, it, vi } from "vitest";
import { FireworksService, type FireworksModelId } from "../src";

const gptOss120b = "accounts/fireworks/models/gpt-oss-120b";

describe("FireworksService", () => {
  it("rejects an unknown model id before resolving a model", () => {
    const resolveModel = vi.fn();

    expect(() =>
      new FireworksService(resolveModel).languageModel(
        "not-a-model" as FireworksModelId,
      ),
    ).toThrow(ZodError);
    expect(resolveModel).not.toHaveBeenCalled();
  });

  it("accepts call settings and Fireworks provider options", () => {
    const model = new MockLanguageModelV4({ modelId: gptOss120b });
    const fireworks = new FireworksService(() => model);
    const bare = fireworks.languageModel(gptOss120b);

    const configured = fireworks.languageModel(gptOss120b, {
      temperature: 0.2,
      maxOutputTokens: 256,
      providerOptions: {
        fireworks: {
          thinking: { type: "enabled", budgetTokens: 1024 },
          reasoningHistory: "interleaved",
        },
      },
    });

    expect(bare).toBe(model);
    expect(configured.modelId).toBe(gptOss120b);
    expect(configured).not.toBe(bare);
  });
});
