import fastifySwagger from "@fastify/swagger";
import type { FastifyInstance } from "fastify";
import { jsonSchemaTransform } from "fastify-type-provider-zod";

export async function registerSwagger(app: FastifyInstance) {
  await app.register(fastifySwagger, {
    openapi: {
      openapi: "3.1.0",
      info: {
        title: "Tickets server",
        version: "0.0.0",
      },
    },
    transform: jsonSchemaTransform,
  });
}
