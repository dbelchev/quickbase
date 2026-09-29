import type { TenantId, UpdateFields } from "./Ticket";

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

export type ProposalView = {
  id: string;
  tenantId: TenantId;
  ticketId: string;
  title: string;
  description: string;
  action: ProposalAction;
  fields?: UpdateFields;
};

export type ProposeResult =
  | { outcome: "not_found" }
  | { outcome: "rejected" }
  | { outcome: "pending"; proposal: ProposalView };

export type DecideResult =
  | { outcome: "applied" }
  | { outcome: "rejected" }
  | { outcome: "not_found" }
  | { outcome: "already_decided" };
