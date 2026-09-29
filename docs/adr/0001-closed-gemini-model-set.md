# Closed Gemini model set

The AI SDK accepts any Gemini model id, including ids it does not know yet. Callers of `@quickbase/inference-provider` can only resolve a chat language model from a fixed Zod enum. A new model is a code change, so a chat agent cannot depend on a string the compiler cannot check.
