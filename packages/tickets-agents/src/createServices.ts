import type { Database } from "@quickbase/database";
import {
  createServices as createInferenceServices,
  type FireworksService,
} from "@quickbase/inference-provider";
import { ticketsAgentBaseSystemPrompt } from "./model";
import { TicketRepository } from "./repository";
import { ProposalService } from "./service/ProposalService";
import { ThreadService } from "./service/ThreadService";
import { TicketsAgentService } from "./service/TicketsAgentService";

export function createServices(
  db: Database,
  fireworks?: FireworksService,
  baseInstructions: string = ticketsAgentBaseSystemPrompt,
) {
  const resolvedFireworks = fireworks ?? createInferenceServices().fireworks;
  const tickets = new TicketRepository(db);
  const proposals = new ProposalService(tickets);
  const threads = new ThreadService();
  return {
    tickets,
    proposals,
    threads,
    ticketsChatAgent: new TicketsAgentService(
      tickets,
      proposals,
      threads,
      resolvedFireworks,
      baseInstructions,
    ),
  };
}
