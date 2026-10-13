import { createProviderRegistry, type LanguageModel } from "ai";
import { type FireworksModelId, type GeminiModelId } from "./model";
import {
  createFireworksProvider,
  createGeminiProvider,
  FireworksService,
  GeminiService,
} from "./service";

export function createServices() {
  const registry = createProviderRegistry({
    gemini: createGeminiProvider(),
    fireworks: createFireworksProvider(),
  });

  return {
    gemini: new GeminiService(
      resolveLanguageModel((modelId: GeminiModelId) =>
        registry.languageModel(`gemini:${modelId}`),
      ),
    ),
    fireworks: new FireworksService(
      resolveLanguageModel((modelId: FireworksModelId) =>
        registry.languageModel(`fireworks:${modelId}`),
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
