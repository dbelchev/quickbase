import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import committed from "../openapi.json" with { type: "json" };
import {
  buildApp,
  openApiDocument,
  type OpenApiDocument,
  type TicketsChatAgent,
} from "../src/app";
import { start } from "../src/index";

const streamHeaders = {
  "content-type": "text/event-stream; charset=utf-8",
  "x-vercel-ai-ui-message-stream": "v1",
};

function uiMessageStream(chunks: string[]): Response {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: streamHeaders });
}

function standIn(): TicketsChatAgent {
  return {
    reply: async () => {
      throw new Error("reply called");
    },
    decide: () => {
      throw new Error("decide called");
    },
  };
}

describe("tickets server", () => {
  it("rejects a missing tenant before the tickets chat agent runs", async () => {
    const app = await buildApp(standIn());

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      headers: { "content-type": "application/json" },
      payload: { threadId: "thread-1", messages: [] },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "Unknown or missing tenant." });
  });

  it("rejects an unknown tenant before the tickets chat agent runs", async () => {
    const app = await buildApp(standIn());

    const response = await app.inject({
      method: "POST",
      url: "/api/decisions",
      headers: {
        "content-type": "application/json",
        "X-Tenant-ID": "tenant-c",
      },
      payload: { proposalId: "proposal-1", decision: "approve" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "Unknown or missing tenant." });
  });

  it("streams the tickets chat agent reply without buffering the bytes", async () => {
    const chunks = ["data: hello\n\n", "data: world\n\n"];
    const app = await buildApp({
      ...standIn(),
      reply: async () => ({
        outcome: "response",
        response: uiMessageStream(chunks),
      }),
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      headers: {
        "content-type": "application/json",
        "X-Tenant-ID": "tenant-a",
      },
      payload: {
        threadId: "thread-1",
        messages: [{ role: "user", parts: [{ type: "text", text: "hi" }] }],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/event-stream");
    expect(response.headers["x-vercel-ai-ui-message-stream"]).toBe("v1");
    expect(response.body).toBe("data: hello\n\ndata: world\n\n");
  });

  it("returns the tickets chat agent error response", async () => {
    const app = await buildApp({
      ...standIn(),
      reply: async () => ({
        outcome: "response",
        response: Response.json({ error: "Missing message." }, { status: 400 }),
      }),
    });

    const response = await post(app, "/api/chat", {
      threadId: "thread-1",
      messages: [],
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "Missing message." });
  });

  it("rejects a thread bound to another tenant as JSON", async () => {
    const app = await buildApp({
      ...standIn(),
      reply: async () => ({ outcome: "mismatch" }),
    });

    const response = await post(app, "/api/chat", {
      threadId: "thread-1",
      messages: [{ role: "user", parts: [{ type: "text", text: "hi" }] }],
    });

    expect(response.statusCode).toBe(409);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.headers["content-type"]).not.toContain("text/event-stream");
    expect(response.json()).toEqual({
      error: "Tenant does not match the thread.",
    });
  });

  it("passes a confirmation proposal id through to the reply", async () => {
    const app = await buildApp({
      ...standIn(),
      reply: async (input) => ({
        outcome: "response",
        response: uiMessageStream([
          `data: ${input.confirmationProposalId}\n\n`,
        ]),
      }),
    });

    const response = await post(app, "/api/chat", {
      threadId: "thread-1",
      messages: [{ role: "user", parts: [{ type: "text", text: "yes" }] }],
      confirmationProposalId: "proposal-1",
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toBe("data: proposal-1\n\n");
  });

  it("does not record a decision from the chat route", async () => {
    const app = await buildApp({
      ...standIn(),
      reply: async () => ({
        outcome: "response",
        response: uiMessageStream(["data: ok\n\n"]),
      }),
    });

    const response = await post(app, "/api/chat", {
      threadId: "thread-1",
      messages: [{ role: "user", parts: [{ type: "text", text: "approve" }] }],
      confirmationProposalId: "proposal-1",
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toBe("data: ok\n\n");
  });

  it("rejects a chat body that is not JSON", async () => {
    const app = await buildApp(standIn());

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      headers: {
        "content-type": "application/json",
        "X-Tenant-ID": "tenant-a",
      },
      payload: "{",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "Invalid JSON." });
  });

  it("rejects a chat body with no messages", async () => {
    const app = await buildApp(standIn());

    const response = await post(app, "/api/chat", { threadId: "thread-1" });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "Invalid request." });
  });

  it("rejects a chat body with no thread", async () => {
    const app = await buildApp(standIn());

    const response = await post(app, "/api/chat", { messages: [] });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "Missing thread." });
  });

  it("rejects a decision body that is not JSON", async () => {
    const app = await buildApp(standIn());

    const response = await app.inject({
      method: "POST",
      url: "/api/decisions",
      headers: {
        "content-type": "application/json",
        "X-Tenant-ID": "tenant-b",
      },
      payload: "{",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "Invalid JSON." });
  });

  it("rejects a decision with no proposal", async () => {
    const app = await buildApp(standIn());

    const response = await post(app, "/api/decisions", { decision: "approve" });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "Missing proposal." });
  });

  it("rejects a decision other than approve or reject", async () => {
    const app = await buildApp(standIn());

    const response = await post(app, "/api/decisions", {
      proposalId: "proposal-1",
      decision: "cancel",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "Invalid decision." });
  });

  it.each([
    ["applied", 200],
    ["rejected", 200],
    ["not_found", 404],
    ["already_decided", 409],
  ] as const)("returns %s for a recorded decision", async (outcome, status) => {
    const app = await buildApp({
      ...standIn(),
      decide: () => ({ outcome }),
    });

    const response = await post(app, "/api/decisions", {
      proposalId: "proposal-1",
      decision: outcome === "rejected" ? "reject" : "approve",
    });

    expect(response.statusCode).toBe(status);
    expect(response.json()).toEqual({ outcome });
  });

  it("has no public route for search or propose", async () => {
    const app = await buildApp(standIn());

    const search = await post(app, "/api/search", { query: "printer" });
    const propose = await post(app, "/api/propose", { id: "1", action: "delete" });

    expect(search.statusCode).toBe(404);
    expect(propose.statusCode).toBe(404);
  });

  it("commits an OpenAPI 3.1 document for the stream and the decision outcomes", async () => {
    const generated = await openApiDocument();

    expect(generated).toEqual(committed);
    expect(generated.openapi).toBe("3.1.0");

    const chat = generated.paths?.["/api/chat"]?.post?.responses?.["200"];
    expect(chat?.content).toHaveProperty("text/event-stream");
    expect(chat?.content).not.toHaveProperty("application/json");
    expect(chat?.headers?.["x-vercel-ai-ui-message-stream"]?.schema).toEqual({
      const: "v1",
    });

    const decisions = generated.paths?.["/api/decisions"]?.post?.responses;
    expect(outcomeEnum(decisions?.["200"])).toEqual(["applied", "rejected"]);
    expect(outcomeEnum(decisions?.["404"])).toEqual(["not_found"]);
    expect(outcomeEnum(decisions?.["409"])).toEqual(["already_decided"]);
  });
});

const ENV_KEY = "GEMINI_TEST_API_KEY";

describe("tickets server startup", () => {
  const original = process.env[ENV_KEY];

  afterEach(() => {
    if (original === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = original;
    }
  });

  it("fails at startup when GEMINI_TEST_API_KEY is missing", async () => {
    delete process.env[ENV_KEY];

    await expect(
      start(async () => {
        throw new Error("listened");
      }),
    ).rejects.toThrow(/GEMINI_TEST_API_KEY/);
  });

  it("listens on port 3001", async () => {
    process.env[ENV_KEY] = "test-key";
    let seen: number | undefined;

    await start(async (_app, options) => {
      seen = options.port;
    });

    expect(seen).toBe(3001);
  });
});

function outcomeEnum(
  response:
    | NonNullable<
        NonNullable<
          NonNullable<OpenApiDocument["paths"]>[string]["post"]
        >["responses"]
      >[string]
    | undefined,
) {
  return response?.content?.["application/json"]?.schema?.properties?.outcome
    ?.enum;
}

function post(
  app: FastifyInstance,
  url: string,
  payload: unknown,
  tenant = "tenant-a",
) {
  return app.inject({
    method: "POST",
    url,
    headers: {
      "content-type": "application/json",
      "X-Tenant-ID": tenant,
    },
    payload: payload as string,
  });
}
