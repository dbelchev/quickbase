import { z } from "zod";

export const decisionBodySchema = z.object({
  proposalId: z.string().min(1),
  decision: z.enum(["approve", "reject"]),
});

export const appliedOrRejectedSchema = z.object({
  outcome: z.enum(["applied", "rejected"]),
});

export const notFoundSchema = z.object({
  outcome: z.literal("not_found"),
});

export const alreadyDecidedSchema = z.object({
  outcome: z.literal("already_decided"),
});

export const decisionStatus = {
  applied: 200,
  rejected: 200,
  not_found: 404,
  already_decided: 409,
} as const;
