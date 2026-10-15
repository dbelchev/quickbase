import { ai, type AxAIArgs, type AxAIService } from "@ax-llm/ax";
import {
  modelFactoryCreateSchema,
  type ModelFactoryCreateInput,
} from "../model";

export class ModelFactoryService {
  create(input: ModelFactoryCreateInput): AxAIService & { modelId: string } {
    const { providerName, apiKey, config } =
      modelFactoryCreateSchema.parse(input);

    return Object.assign(
      ai({ name: providerName, apiKey, config } as AxAIArgs<string>),
      { modelId: config.model },
    );
  }
}
