# Proposals and threads stay on their services

`@quickbase/tickets-agents` stores tickets in the ticket repository. Proposals live on ProposalService and threads live on ThreadService. A proposal is an uncommitted request and a thread is one conversation, so neither is a ticket. The repository searches tickets and applies an update or delete only after ProposalService records an approval.
