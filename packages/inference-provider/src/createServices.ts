import { createProviderRegistry, type LanguageModel } from "ai";
import { type GeminiModelId } from "./model";
import { createGeminiProvider, GeminiService } from "./service";

export function createServices() {
  const registry = createProviderRegistry({
    gemini: createGeminiProvider(),
  });

  return {
    gemini: new GeminiService(
      resolveLanguageModel((modelId: GeminiModelId) =>
        registry.languageModel(`gemini:${modelId}`),
      ),
    ),
  };
}

function resolveLanguageModel<ModelId extends string>(
  languageModel: (modelId: ModelId) => LanguageModel,
) {
  return (modelId: ModelId) => {
    const model = languageModel(modelId);
    if (typeof model === "string") {
      throw new Error(
        `Expected a resolved language model, received "${model}".`,
      );
    }
    return model;
  };
}
