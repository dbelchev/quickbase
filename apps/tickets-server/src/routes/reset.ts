import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import type { TicketsChatAgent } from "../model";

export function registerResetRoutes(
  app: FastifyInstance,
  ticketsChatAgent: TicketsChatAgent,
) {
  app.withTypeProvider<ZodTypeProvider>().post(
    "/api/reset",
    {
      schema: {
        response: {
          204: z.void().describe("Tickets reseeded"),
        },
      },
    },
    async (_request, reply) => {
      ticketsChatAgent.reset();
      return reply.code(204).send();
    },
  );
}
