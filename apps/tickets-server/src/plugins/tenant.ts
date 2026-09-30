import type { FastifyInstance } from "fastify";
import { readTenantId, unknownTenantError } from "../model";

export function registerTenantHook(app: FastifyInstance) {
  app.addHook("onRequest", async (request, reply) => {
    const path = request.url.split("?")[0];
    if (!path.startsWith("/api/") || path === "/api/reset") return;

    if (!readTenantId(request.headers["x-tenant-id"])) {
      return reply.status(400).send({ error: unknownTenantError });
    }
  });
}
