import { afterEach, describe, expect, it } from "vitest";
import { createServices, GeminiService } from "../src";
import { geminiModelIdSchema } from "../src/model";

const ENV_KEY = "GEMINI_TEST_API_KEY";

describe("createServices", () => {
  const original = process.env[ENV_KEY];

  afterEach(() => {
    if (original === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = original;
    }
  });

  it("returns a Gemini service that resolves each supported model", () => {
    process.env[ENV_KEY] = "test-key";
    const { gemini } = createServices();

    expect(gemini).toBeInstanceOf(GeminiService);
    for (const modelId of geminiModelIdSchema.options) {
      expect(gemini.languageModel(modelId).modelId).toBe(modelId);
    }
  });

  it("throws when the api key is missing", () => {
    delete process.env[ENV_KEY];

    expect(() => createServices()).toThrow(/GEMINI_TEST_API_KEY/);
  });

  it("throws when the api key is blank", () => {
    process.env[ENV_KEY] = "   ";

    expect(() => createServices()).toThrow(/GEMINI_TEST_API_KEY/);
  });
});
