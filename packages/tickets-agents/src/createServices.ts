import { createServices as createInferenceServices } from "@quickbase/inference-provider";
import { openTicketDatabase, TicketRepository } from "./repository";
import { TicketsAgentService } from "./service";

export function createServices() {
  const { gemini } = createInferenceServices();
  return {
    ticketsAgent: new TicketsAgentService(
      new TicketRepository(openTicketDatabase()),
      gemini,
    ),
  };
}
