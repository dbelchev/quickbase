import type { FastifyInstance } from "fastify";
import { hasZodFastifySchemaValidationErrors } from "fastify-type-provider-zod";
import { invalidJsonError, validationMessage } from "../model";

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    if (isInvalidJson(error)) {
      return reply.status(400).send({ error: invalidJsonError });
    }
    if (hasZodFastifySchemaValidationErrors(error)) {
      const instancePaths = error.validation.map((issue) => issue.instancePath);
      return reply.status(400).send({
        error: validationMessage(request.url, instancePaths),
      });
    }
    return reply.send(error);
  });
}

function isInvalidJson(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "FST_ERR_CTP_INVALID_JSON_BODY"
  );
}
