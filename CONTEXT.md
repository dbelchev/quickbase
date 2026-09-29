# Quickbase

Language for a tickets chat agent, and for the inference provider that resolves the model it runs.

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

**Tickets chat agent**:
A chat agent for one tenant's tickets.
_Avoid_: Planner, bot, assistant

**Ticket**:
A support item with a title, a description, and a status of open or closed.
_Avoid_: Issue, case

**Tenant**:
The owner of a set of tickets.
_Avoid_: Organization, account, company

**Proposal**:
A requested update or delete of one ticket. It stays pending until it is approved or rejected.
_Avoid_: Mutation, edit

**Thread**:
A conversation bound to one tenant.
_Avoid_: Session, chat
