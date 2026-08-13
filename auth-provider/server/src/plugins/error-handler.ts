import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ApiError, INTERNAL_ERROR_CODE, INTERNAL_ERROR_MESSAGE } from "@sso/shared";

/**
 * Standard error handler. Never leaks stack traces, hashes, tokens, or internal details.
 */
export async function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  request.log.error(error);
  const requestId = request.id;

  // JSON-schema validation errors from Fastify.
  if (error.validation) {
    reply.status(400).send({
      error: { code: "VALIDATION_ERROR", message: "Invalid request", requestId },
    });
    return;
  }

  // Our domain errors carry their own status + code + message.
  if (error instanceof ApiError) {
    reply.status(error.statusCode).send(error.toErrorBody(requestId));
    return;
  }

  // Any 5xx
  const statusCode = error.statusCode ?? 500;
  if (statusCode >= 500) {
    reply.status(statusCode).send({
      error: { code: INTERNAL_ERROR_CODE, message: INTERNAL_ERROR_MESSAGE, requestId },
    });
    return;
  }

  // Other known HTTP errors (4xx) keep their status but never leak internal
  // details (Fastify's FST_ERR_* messages are not client-safe).
  reply.status(statusCode).send({
    error: { code: "BAD_REQUEST", message: "Bad request", requestId },
  });
}
