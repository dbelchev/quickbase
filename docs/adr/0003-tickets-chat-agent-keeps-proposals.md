# Tickets chat agent keeps proposals and threads

`@quickbase/tickets-agents` stores tickets in the repository. Proposals and threads stay on the tickets chat agent. A proposal is an uncommitted request and a thread is one conversation, so neither is a ticket. The repository searches tickets and applies an update or delete only after the agent records an approval.
