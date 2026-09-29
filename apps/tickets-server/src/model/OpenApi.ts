export type OpenApiResponse = {
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
  paths?: Record<
    string,
    { post?: { responses?: Record<string, OpenApiResponse> } }
  >;
};

export const uiMessageStreamResponse = {
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
