import type { GoogleLanguageModelOptions } from "@ai-sdk/google";
import { defaultSettingsMiddleware, type LanguageModel } from "ai";
import { z } from "zod";

type MiddlewareSettings = NonNullable<
  Parameters<typeof defaultSettingsMiddleware>[0]["settings"]
>;

type AgentOwnedSetting = "tools" | "toolChoice" | "responseFormat";

export type GeminiModelConfig = Omit<
  MiddlewareSettings,
  AgentOwnedSetting | "providerOptions"
> & {
  providerOptions?: {
    google?: GoogleLanguageModelOptions;
  };
};

export const geminiModelIds = [
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-pro-preview",
  "gemini-3.1-flash-lite-preview",
  "gemini-3-pro-preview",
  "gemini-3-flash-preview",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash-lite-preview-06-17",
  "gemini-2.0-flash",
] as const;

export const geminiModelIdSchema = z.enum(geminiModelIds);

export type GeminiModelId = z.infer<typeof geminiModelIdSchema>;

export type ResolvedLanguageModel = Exclude<LanguageModel, string>;
