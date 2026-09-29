import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  alreadyDecidedSchema,
  appliedOrRejectedSchema,
  decisionBodySchema,
  decisionStatus,
  errorBodySchema,
  notFoundSchema,
  readTenantId,
  tenantHeadersSchema,
  unknownTenantError,
  type TicketsChatAgent,
} from "../model";

export function registerDecisionRoutes(
  app: FastifyInstance,
  ticketsChatAgent: TicketsChatAgent,
) {
  app.withTypeProvider<ZodTypeProvider>().post(
    "/api/decisions",
    {
      schema: {
        headers: tenantHeadersSchema,
        body: decisionBodySchema,
        response: {
          200: appliedOrRejectedSchema,
          400: errorBodySchema,
          404: notFoundSchema,
          409: alreadyDecidedSchema,
        },
      },
    },
    async (request, reply) => {
      const tenantId = readTenantId(request.headers["x-tenant-id"]);
      if (!tenantId) {
        return reply.status(400).send({ error: unknownTenantError });
      }

      const result = ticketsChatAgent.decide({
        tenantId,
        proposalId: request.body.proposalId,
        decision: request.body.decision,
      });
      return reply.status(decisionStatus[result.outcome]).send(result);
    },
  );
}
