import { z } from "zod";
import { tenantMismatchError } from "./Error";

export const chatBodySchema = z.object({
  threadId: z.string().min(1),
  messages: z.array(z.unknown()),
  confirmationProposalId: z.string().optional(),
});

export const mismatchSchema = z.object({
  error: z.literal(tenantMismatchError),
});
