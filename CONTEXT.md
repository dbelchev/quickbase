# Quickbase

Language for resolving a language model from an inference provider so a chat agent can run it.

## Language

**Inference provider**:
A backend that runs language models. There can be more than one.
_Avoid_: Engine, vendor, LLM backend

**Model**:
A language model an inference provider can run, chosen from that provider's supported set.
_Avoid_: LLM, checkpoint

**Gemini**:
An inference provider.
_Avoid_: Google service

**Chat agent**:
A caller that runs a model. It is not an inference provider.
_Avoid_: Bot, assistant
