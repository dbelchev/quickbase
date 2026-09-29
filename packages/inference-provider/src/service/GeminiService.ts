import { createGoogle } from "@ai-sdk/google";
import {
  customProvider,
  defaultSettingsMiddleware,
  wrapLanguageModel,
  type LanguageModel,
} from "ai";
import {
  geminiModelIdSchema,
  type GeminiModelConfig,
  type GeminiModelId,
} from "../model";

type ResolvedLanguageModel = Exclude<LanguageModel, string>;

export class GeminiService {
  constructor(
    private readonly resolveModel: (
      modelId: GeminiModelId,
    ) => ResolvedLanguageModel,
  ) { }

  languageModel(modelId: GeminiModelId, config?: GeminiModelConfig) {
    const id = geminiModelIdSchema.parse(modelId);
    const model = this.resolveModel(id);

    if (config === undefined || !hasSettings(config)) {
      return model;
    }

    return wrapLanguageModel({
      model,
      middleware: defaultSettingsMiddleware({ settings: config }),
    });
  }
}

function hasSettings(settings: GeminiModelConfig) {
  return Object.values(settings).some((value) => value !== undefined);
}

export function createGeminiProvider() {
  const apiKey = process.env.GEMINI_TEST_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "GEMINI_TEST_API_KEY is required to resolve a Gemini model.",
    );
  }

  const google = createGoogle({ apiKey });
  return customProvider({
    languageModels: Object.fromEntries(
      geminiModelIdSchema.options.map((modelId) => [modelId, google(modelId)]),
    ),
  });
}