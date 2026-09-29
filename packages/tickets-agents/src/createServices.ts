import { createServices as createInferenceServices } from "@quickbase/inference-provider";
import { createRepository } from "./repository";
import { TicketsChatAgentService } from "./service";

export function createServices() {
  const { gemini } = createInferenceServices();
  return {
    ticketsChatAgent: new TicketsChatAgentService(
      createRepository(),
      gemini,
    ),
  };
}
