import Fastify, { type FastifyInstance } from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import type { TicketsChatAgent } from "./model";
import { registerErrorHandler } from "./plugins/errorHandler";
import { registerSwagger } from "./plugins/swagger";
import { registerTenantHook } from "./plugins/tenant";
import { registerChatRoutes } from "./routes/chat";
import { registerDecisionRoutes } from "./routes/decisions";
import { registerResetRoutes } from "./routes/reset";

export type { TicketsChatAgent } from "./model";

export async function buildApp(
  ticketsChatAgent: TicketsChatAgent,
): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  await registerSwagger(app);
  registerErrorHandler(app);
  registerTenantHook(app);
  registerChatRoutes(app, ticketsChatAgent);
  registerDecisionRoutes(app, ticketsChatAgent);
  registerResetRoutes(app, ticketsChatAgent);
  return app;
}
