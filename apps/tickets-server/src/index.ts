import path from "node:path";
import { pathToFileURL } from "node:url";
import { createServices } from "@quickbase/tickets-agents";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./app";

export const port = 3001;

export async function start(
  listen: (
    app: FastifyInstance,
    options: { port: number },
  ) => Promise<unknown> = (app, options) => app.listen(options),
) {
  const { ticketsAgent } = createServices();
  const app = await buildApp(ticketsAgent);
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
