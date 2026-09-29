import type { FastifyInstance } from "fastify";
import { readTenantId, unknownTenantError } from "../model";

export function registerTenantHook(app: FastifyInstance) {
  app.addHook("onRequest", async (request, reply) => {
    if (!request.url.startsWith("/api/")) return;

    if (!readTenantId(request.headers["x-tenant-id"])) {
      return reply.status(400).send({ error: unknownTenantError });
    }
  });
}
