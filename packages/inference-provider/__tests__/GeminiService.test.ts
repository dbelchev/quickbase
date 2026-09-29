import { MockLanguageModelV4 } from "ai/test";
import { ZodError } from "zod";
import { describe, expect, it, vi } from "vitest";
import { GeminiService } from "../src";
import { type GeminiModelId } from "../src/model";

describe("GeminiService", () => {
  it("rejects an unknown model id before resolving a model", () => {
    const resolveModel = vi.fn();

    expect(() =>
      new GeminiService(resolveModel).languageModel(
        "not-a-model" as GeminiModelId,
      ),
    ).toThrow(ZodError);
    expect(resolveModel).not.toHaveBeenCalled();
  });

  it("accepts call settings and Google provider options", () => {
    const model = new MockLanguageModelV4({ modelId: "gemini-2.5-flash" });
    const gemini = new GeminiService(() => model);
    const bare = gemini.languageModel("gemini-2.5-flash");

    const configured = gemini.languageModel("gemini-2.5-flash", {
      temperature: 0.2,
      maxOutputTokens: 256,
      providerOptions: {
        google: {
          thinkingConfig: { thinkingLevel: "low" },
          structuredOutputs: true,
        },
      },
    });

    expect(bare).toBe(model);
    expect(configured.modelId).toBe("gemini-2.5-flash");
    expect(configured).not.toBe(bare);
  });
});
