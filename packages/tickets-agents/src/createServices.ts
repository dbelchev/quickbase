import type { Database } from "@quickbase/database";
import { createServices as createInferenceServices } from "@quickbase/inference-provider";
import { TicketRepository } from "./repository";
import { ProposalService, TicketsAgentService } from "./service";

export function createServices(db: Database) {
  const { gemini } = createInferenceServices();
  const tickets = new TicketRepository(db);
  const proposals = new ProposalService(tickets);
  return {
    tickets,
    proposals,
    ticketsChatAgent: new TicketsAgentService(tickets, proposals, gemini),
  };
}
