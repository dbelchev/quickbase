import type {
  DecideResult,
  Decision,
  ReplyInput,
  ReplyResult,
  TenantId,
} from "@quickbase/tickets-agents";

export type TicketsChatAgent = {
  reply(input: ReplyInput): Promise<ReplyResult>;
  decide(input: {
    tenantId: TenantId;
    proposalId: string;
    decision: Decision;
  }): DecideResult;
  reset(): void;
};
