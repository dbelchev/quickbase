import { afterEach, describe, expect, it } from "vitest";
import { createServices, FireworksService, GeminiService } from "../src";
import { fireworksModelIdSchema, geminiModelIdSchema } from "../src/model";

const GEMINI_KEY = "GEMINI_TEST_API_KEY";
const FIREWORKS_KEY = "FIREWORKS_TEST_API_KEY";

describe("createServices", () => {
  const originalGemini = process.env[GEMINI_KEY];
  const originalFireworks = process.env[FIREWORKS_KEY];

  afterEach(() => {
    restore(GEMINI_KEY, originalGemini);
    restore(FIREWORKS_KEY, originalFireworks);
  });

  it("returns a Fireworks service that resolves the supported model", () => {
    process.env[GEMINI_KEY] = "test-key";
    process.env[FIREWORKS_KEY] = "test-key";
    const { fireworks } = createServices();

    expect(fireworks).toBeInstanceOf(FireworksService);
    for (const modelId of fireworksModelIdSchema.options) {
      expect(fireworks.languageModel(modelId).modelId).toBe(modelId);
    }
  });

  it("returns a Gemini service that resolves each supported model", () => {
    process.env[GEMINI_KEY] = "test-key";
    process.env[FIREWORKS_KEY] = "test-key";
    const { gemini } = createServices();

    expect(gemini).toBeInstanceOf(GeminiService);
    for (const modelId of geminiModelIdSchema.options) {
      expect(gemini.languageModel(modelId).modelId).toBe(modelId);
    }
  });

  it("throws when the api key is missing", () => {
    delete process.env[GEMINI_KEY];

    expect(() => createServices()).toThrow(/GEMINI_TEST_API_KEY/);
  });

  it("throws when the api key is blank", () => {
    process.env[GEMINI_KEY] = "   ";

    expect(() => createServices()).toThrow(/GEMINI_TEST_API_KEY/);
  });

  it("throws when the Fireworks key is missing", () => {
    process.env[GEMINI_KEY] = "test-key";
    delete process.env[FIREWORKS_KEY];

    expect(() => createServices()).toThrow(/FIREWORKS_TEST_API_KEY/);
  });

  it("throws when the Fireworks key is blank", () => {
    process.env[GEMINI_KEY] = "test-key";
    process.env[FIREWORKS_KEY] = "   ";

    expect(() => createServices()).toThrow(/FIREWORKS_TEST_API_KEY/);
  });
});

function restore(key: string, original: string | undefined) {
  if (original === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = original;
  }
}
