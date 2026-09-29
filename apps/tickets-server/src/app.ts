import { Readable } from "node:stream";
import type {
  DecideResult,
  Decision,
  ReplyInput,
  ReplyResult,
  TenantId,
} from "@quickbase/tickets-agents";
import fastifySwagger from "@fastify/swagger";
import Fastify, { type FastifyInstance, type FastifyReply } from "fastify";
import {
  hasZodFastifySchemaValidationErrors,
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { z } from "zod";

export type TicketsChatAgent = {
  reply(input: ReplyInput): Promise<ReplyResult>;
  decide(input: {
    tenantId: TenantId;
    proposalId: string;
    decision: Decision;
  }): DecideResult;
};

const chatBodySchema = z.object({
  threadId: z.string().min(1),
  messages: z.array(z.unknown()),
  confirmationProposalId: z.string().optional(),
});

const decisionBodySchema = z.object({
  proposalId: z.string().min(1),
  decision: z.enum(["approve", "reject"]),
});

const decisionStatus = {
  applied: 200,
  rejected: 200,
  not_found: 404,
  already_decided: 409,
} as const;

const tenantHeaders = z.object({
  "x-tenant-id": z.enum(["tenant-a", "tenant-b"]),
});

const chatErrorSchema = z.object({
  error: z.enum([
    "Unknown or missing tenant.",
    "Invalid JSON.",
    "Missing thread.",
  ]),
});

const mismatchSchema = z.object({
  error: z.literal("Tenant does not match the thread."),
});

const decisionErrorSchema = z.object({
  error: z.enum([
    "Unknown or missing tenant.",
    "Invalid JSON.",
    "Missing proposal.",
    "Invalid decision.",
  ]),
});

const appliedOrRejectedSchema = z.object({
  outcome: z.enum(["applied", "rejected"]),
});

const notFoundSchema = z.object({
  outcome: z.literal("not_found"),
});

const alreadyDecidedSchema = z.object({
  outcome: z.literal("already_decided"),
});

const uiMessageStreamResponse = {
  description: "AI SDK UI message stream",
  headers: {
    "x-vercel-ai-ui-message-stream": {
      required: true,
      schema: { const: "v1" },
    },
  },
  content: {
    "text/event-stream": {
      schema: { type: "string" },
    },
  },
};

export async function buildApp(
  ticketsChatAgent: TicketsChatAgent,
): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
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
  app.setErrorHandler((error, request, reply) => {
    if (isInvalidJson(error)) {
      return reply.status(400).send({ error: "Invalid JSON." });
    }
    if (hasZodFastifySchemaValidationErrors(error)) {
      return reply.status(400).send({
        error: validationMessage(request.url, error.validation),
      });
    }
    return reply.send(error);
  });

  app.addHook("onRequest", async (request, reply) => {
    if (!request.url.startsWith("/api/")) return;

    const header = request.headers["x-tenant-id"];
    const tenantId = Array.isArray(header) ? undefined : header;
    if (tenantId !== "tenant-a" && tenantId !== "tenant-b") {
      return reply.status(400).send({ error: "Unknown or missing tenant." });
    }
  });

  app.withTypeProvider<ZodTypeProvider>().post(
    "/api/chat",
    {
      schema: {
        headers: tenantHeaders,
        body: chatBodySchema,
        response: {
          400: chatErrorSchema,
          409: mismatchSchema,
        },
      },
    },
    async (request, reply) => {
      const tenantId = request.headers["x-tenant-id"] as TenantId;
      const result = await ticketsChatAgent.reply({
        tenantId,
        threadId: request.body.threadId,
        messages: request.body.messages,
        confirmationProposalId: request.body.confirmationProposalId,
      });

      if (result.outcome === "mismatch") {
        return reply
          .status(409)
          .send({ error: "Tenant does not match the thread." });
      }

      return sendAgentResponse(reply, result.response);
    },
  );

  app.withTypeProvider<ZodTypeProvider>().post(
    "/api/decisions",
    {
      schema: {
        headers: tenantHeaders,
        body: decisionBodySchema,
        response: {
          200: appliedOrRejectedSchema,
          400: decisionErrorSchema,
          404: notFoundSchema,
          409: alreadyDecidedSchema,
        },
      },
    },
    async (request, reply) => {
      const tenantId = request.headers["x-tenant-id"] as TenantId;
      const result = ticketsChatAgent.decide({
        tenantId,
        proposalId: request.body.proposalId,
        decision: request.body.decision,
      });
      return reply.status(decisionStatus[result.outcome]).send(result);
    },
  );

  return app;
}

type OpenApiResponse = {
  description?: string;
  headers?: Record<string, { required?: boolean; schema?: { const?: string } }>;
  content?: Record<
    string,
    {
      schema?: {
        type?: string;
        properties?: { outcome?: { enum?: string[] } };
      };
    }
  >;
};

export type OpenApiDocument = {
  openapi: string;
  info: { title: string; version: string };
  components?: { schemas?: Record<string, unknown> };
  paths?: Record<string, { post?: { responses?: Record<string, OpenApiResponse> } }>;
};

export async function openApiDocument(): Promise<OpenApiDocument> {
  const app = await buildApp({
    async reply() {
      return { outcome: "mismatch" };
    },
    decide() {
      return { outcome: "not_found" };
    },
  });
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

function sendAgentResponse(reply: FastifyReply, response: Response) {
  reply.status(response.status);
  response.headers.forEach((value, key) => {
    reply.header(key, value);
  });
  if (!response.body) return reply.send();
  return reply.send(Readable.fromWeb(response.body));
}

function isInvalidJson(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "FST_ERR_CTP_INVALID_JSON_BODY"
  );
}

function validationMessage(
  url: string,
  validation: Array<{ instancePath: string }>,
): string {
  const paths = validation.map((issue) => issue.instancePath);
  if (url.startsWith("/api/chat")) {
    if (
      paths.some((path) => path === "/threadId" || path.startsWith("/threadId/"))
    ) {
      return "Missing thread.";
    }
  }
  if (url.startsWith("/api/decisions")) {
    if (
      paths.some(
        (path) => path === "/proposalId" || path.startsWith("/proposalId/"),
      )
    ) {
      return "Missing proposal.";
    }
    if (
      paths.some((path) => path === "/decision" || path.startsWith("/decision/"))
    ) {
      return "Invalid decision.";
    }
  }
  return "Invalid request.";
}
