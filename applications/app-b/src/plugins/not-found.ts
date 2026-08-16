import type { FastifyReply, FastifyRequest } from "fastify";

/** 404 handler using the standard error format. */
export async function notFoundHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  reply.status(404).send({
    error: {
      code: "NOT_FOUND",
      message: `Route ${request.method} ${request.url} not found`,
      requestId: request.id,
    },
  });
}
