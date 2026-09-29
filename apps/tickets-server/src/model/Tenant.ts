import type { TenantId } from "@quickbase/tickets-agents";
import { z } from "zod";

export const tenantIdSchema = z.enum(["tenant-a", "tenant-b"]);

export const tenantHeadersSchema = z.object({
  "x-tenant-id": tenantIdSchema,
});

export function readTenantId(
  header: string | string[] | undefined,
): TenantId | undefined {
  const parsed = tenantIdSchema.safeParse(
    Array.isArray(header) ? undefined : header,
  );
  return parsed.success ? parsed.data : undefined;
}
