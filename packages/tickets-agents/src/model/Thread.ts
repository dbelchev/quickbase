import type { TenantId } from "./Ticket";

export type ThreadRecord = {
  tenantId: TenantId;
  messages: unknown[];
};
