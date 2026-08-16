import type { FastifyInstance } from "fastify";

export async function healthRoutes(server: FastifyInstance): Promise<void> {
  server.get("/health", { logLevel: "silent" }, async () => {
    return { status: "ok" };
  });
}
