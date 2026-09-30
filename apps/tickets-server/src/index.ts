import path from "node:path";
import { pathToFileURL } from "node:url";
import { createServices as createDatabase } from "@quickbase/database";
import { createServices as createTicketsAgents } from "@quickbase/tickets-agents";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./app";

export const port = 3001;

export async function start(
  listen: (
    app: FastifyInstance,
    options: { port: number },
  ) => Promise<unknown> = (app, options) => app.listen(options),
) {
  const { database } = createDatabase();
  const { ticketsChatAgent } = createTicketsAgents(database);
  const app = await buildApp(ticketsChatAgent);
  await listen(app, { port });
  return app;
}

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(path.resolve(entry)).href;
}

if (isDirectRun()) {
  start().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}
