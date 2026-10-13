# Closed Fireworks model set

The AI SDK accepts any Fireworks model id, including ids it does not know yet. Callers of `@quickbase/inference-provider` can only resolve a chat language model from a fixed Zod enum. The set contains `accounts/fireworks/models/gpt-oss-120b`. A new model is a code change, so a chat agent cannot depend on a string the compiler cannot check.
