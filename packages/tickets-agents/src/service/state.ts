import type { TenantId, UpdateFields } from "../model";

export type ProposalAction = "update" | "delete";

export type ProposalState = "pending" | "applied" | "rejected";

export type Proposal = {
  id: string;
  tenantId: TenantId;
  ticketId: string;
  title: string;
  description: string;
  action: ProposalAction;
  fields?: UpdateFields;
  state: ProposalState;
};

type ThreadRecord = {
  tenantId: TenantId;
  messages: unknown[];
};

type AgentState = {
  proposals: Proposal[];
  threads: Map<string, ThreadRecord>;
};

const globalAgent = globalThis as typeof globalThis & {
  __quickbaseTicketsChatAgent?: AgentState;
};

export function agentState(): AgentState {
  globalAgent.__quickbaseTicketsChatAgent ??= {
    proposals: [],
    threads: new Map(),
  };
  return globalAgent.__quickbaseTicketsChatAgent;
}

export function resetAgentState(): void {
  globalAgent.__quickbaseTicketsChatAgent = {
    proposals: [],
    threads: new Map(),
  };
}
