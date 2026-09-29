import { z } from "zod";

export const tenantIdSchema = z.enum(["tenant-a", "tenant-b"]);

export type TenantId = z.infer<typeof tenantIdSchema>;

export const ticketStatusSchema = z.enum(["open", "closed"]);

export type TicketStatus = z.infer<typeof ticketStatusSchema>;

export const ticketSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  status: ticketStatusSchema,
});

export type Ticket = z.infer<typeof ticketSchema>;

export const updateFieldsSchema = z.strictObject({
  title: z.string().optional(),
  description: z.string().optional(),
  status: ticketStatusSchema.optional(),
});

export type UpdateFields = z.infer<typeof updateFieldsSchema>;

export const decisionSchema = z.enum(["approve", "reject"]);

export type Decision = z.infer<typeof decisionSchema>;

export const searchTicketsInputSchema = z.object({
  query: z.string().describe("Text to match against title and description"),
});

export const mutateTicketInputSchema = z.object({
  id: z.string(),
  action: z.enum(["update", "delete"]),
  fields: z.record(z.string(), z.unknown()).optional(),
});
