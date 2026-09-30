import type { TenantId } from "./Ticket";

export type ThreadRecord = {
  tenantId: TenantId;
  messages: unknown[];
};

export type AgentState = {
  threads: Map<string, ThreadRecord>;
};
