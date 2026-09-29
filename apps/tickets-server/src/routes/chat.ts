import { Readable } from "node:stream";
import type { FastifyInstance, FastifyReply } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  chatBodySchema,
  errorBodySchema,
  mismatchSchema,
  readTenantId,
  tenantHeadersSchema,
  tenantMismatchError,
  unknownTenantError,
  type TicketsChatAgent,
} from "../model";

export function registerChatRoutes(
  app: FastifyInstance,
  ticketsChatAgent: TicketsChatAgent,
) {
  app.withTypeProvider<ZodTypeProvider>().post(
    "/api/chat",
    {
      schema: {
        headers: tenantHeadersSchema,
        body: chatBodySchema,
        response: {
          400: errorBodySchema,
          409: mismatchSchema,
        },
      },
    },
    async (request, reply) => {
      const tenantId = readTenantId(request.headers["x-tenant-id"]);
      if (!tenantId) {
        return reply.status(400).send({ error: unknownTenantError });
      }

      const result = await ticketsChatAgent.reply({
        tenantId,
        threadId: request.body.threadId,
        messages: request.body.messages,
        confirmationProposalId: request.body.confirmationProposalId,
      });

      if (result.outcome === "mismatch") {
        return reply.status(409).send({ error: tenantMismatchError });
      }

      return sendAgentResponse(reply, result.response);
    },
  );
}

function sendAgentResponse(reply: FastifyReply, response: Response) {
  reply.status(response.status);
  response.headers.forEach((value, key) => {
    reply.header(key, value);
  });
  if (!response.body) return reply.send();
  return reply.send(Readable.fromWeb(response.body));
}
