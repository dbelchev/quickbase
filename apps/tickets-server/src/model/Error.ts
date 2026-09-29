import { z } from "zod";

export const unknownTenantError = "Unknown or missing tenant.";
export const invalidJsonError = "Invalid JSON.";
export const missingThreadError = "Missing thread.";
export const missingProposalError = "Missing proposal.";
export const invalidDecisionError = "Invalid decision.";
export const invalidRequestError = "Invalid request.";
export const tenantMismatchError = "Tenant does not match the thread.";

export const errorBodySchema = z.object({
  error: z.string(),
});

export function validationMessage(url: string, instancePaths: string[]): string {
  if (url.startsWith("/api/chat")) {
    if (
      instancePaths.some(
        (path) => path === "/threadId" || path.startsWith("/threadId/"),
      )
    ) {
      return missingThreadError;
    }
  }
  if (url.startsWith("/api/decisions")) {
    if (
      instancePaths.some(
        (path) => path === "/proposalId" || path.startsWith("/proposalId/"),
      )
    ) {
      return missingProposalError;
    }
    if (
      instancePaths.some(
        (path) => path === "/decision" || path.startsWith("/decision/"),
      )
    ) {
      return invalidDecisionError;
    }
  }
  return invalidRequestError;
}
