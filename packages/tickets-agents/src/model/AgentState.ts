import type { Proposal } from "./Proposal";
import type { TenantId } from "./Ticket";

export type ThreadRecord = {
  tenantId: TenantId;
  messages: unknown[];
};

export type AgentState = {
  proposals: Proposal[];
  threads: Map<string, ThreadRecord>;
};
