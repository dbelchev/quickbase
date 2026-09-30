import type { Database } from "@quickbase/database";
import { createServices as createInferenceServices } from "@quickbase/inference-provider";
import { TicketRepository } from "./repository";
import { TicketsAgentService } from "./service";

export function createServices(db: Database) {
  const { gemini } = createInferenceServices();
  const tickets = new TicketRepository(db);
  return {
    tickets,
    ticketsChatAgent: new TicketsAgentService(tickets, gemini),
  };
}
