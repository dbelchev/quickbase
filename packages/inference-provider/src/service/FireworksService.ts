import { createFireworks } from "@ai-sdk/fireworks";
import {
  customProvider,
  defaultSettingsMiddleware,
  wrapLanguageModel,
} from "ai";
import {
  fireworksModelIdSchema,
  type FireworksModelConfig,
  type FireworksModelId,
  type ResolvedLanguageModel,
} from "../model";

export class FireworksService {
  constructor(
    private readonly resolveModel: (
      modelId: FireworksModelId,
    ) => ResolvedLanguageModel,
  ) { }

  languageModel(modelId: FireworksModelId, config?: FireworksModelConfig) {
    const id = fireworksModelIdSchema.parse(modelId);
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

function hasSettings(settings: FireworksModelConfig) {
  return Object.values(settings).some((value) => value !== undefined);
}

export function createFireworksProvider() {
  const apiKey = process.env.FIREWORKS_TEST_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "FIREWORKS_TEST_API_KEY is required to resolve a Fireworks model.",
    );
  }

  const fireworks = createFireworks({ apiKey });
  return customProvider({
    languageModels: Object.fromEntries(
      fireworksModelIdSchema.options.map((modelId) => [
        modelId,
        fireworks(modelId),
      ]),
    ),
  });
}
