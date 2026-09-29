import { resetTickets } from "./repository";
import { resetAgentState } from "./service/state";

export function resetStore(): void {
  resetTickets();
  resetAgentState();
}
