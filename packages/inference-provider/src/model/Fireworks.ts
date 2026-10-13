import type { FireworksLanguageModelOptions } from "@ai-sdk/fireworks";
import { defaultSettingsMiddleware } from "ai";
import { z } from "zod";

type MiddlewareSettings = NonNullable<
  Parameters<typeof defaultSettingsMiddleware>[0]["settings"]
>;

type AgentOwnedSetting = "tools" | "toolChoice" | "responseFormat";

export type FireworksModelConfig = Omit<
  MiddlewareSettings,
  AgentOwnedSetting | "providerOptions"
> & {
  providerOptions?: {
    fireworks?: FireworksLanguageModelOptions;
  };
};

export const fireworksModelIds = [
  "accounts/fireworks/models/gpt-oss-120b",
] as const;

export const fireworksModelIdSchema = z.enum(fireworksModelIds);

export type FireworksModelId = z.infer<typeof fireworksModelIdSchema>;
