import type { TenantId } from "./Ticket";

export type ReplyInput = {
  tenantId: TenantId;
  threadId: string;
  messages: unknown[];
  confirmationProposalId?: string;
};

export type ReplyObservers = {
  onModelCall?: (call: { modelId: string; messages: unknown }) => void;
  onToolResults?: (results: unknown[]) => void;
};

export type ReplyResult =
  | { outcome: "mismatch" }
  | { outcome: "response"; response: Response };

export type IncomingMessage = {
  role?: string;
  parts?: Array<{ type?: string; text?: string }>;
};
