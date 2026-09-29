import { buildApp } from "./app";
import {
  type OpenApiDocument,
  type TicketsChatAgent,
  uiMessageStreamResponse,
} from "./model";

export type { OpenApiDocument };

export async function openApiDocument(): Promise<OpenApiDocument> {
  const app = await buildApp(standIn());
  await app.ready();
  const document = app.swagger() as OpenApiDocument;
  const chat = document.paths?.["/api/chat"]?.post;
  if (chat?.responses) {
    // A JSON response schema would make a generated client parse the reply as JSON.
    chat.responses["200"] = uiMessageStreamResponse;
  }
  if (
    document.components?.schemas &&
    Object.keys(document.components.schemas).length === 0
  ) {
    delete document.components.schemas;
    if (document.components && Object.keys(document.components).length === 0) {
      delete document.components;
    }
  }
  await app.close();
  return document;
}

function standIn(): TicketsChatAgent {
  return {
    async reply() {
      return { outcome: "mismatch" };
    },
    decide() {
      return { outcome: "not_found" };
    },
  };
}
