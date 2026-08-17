import type { FastifyInstance } from "fastify";
import { pingComponent, type ComponentHealth } from "@sso/shared";

interface ReadinessBody {
  status: "ok" | "degraded";
  checks: { database: ComponentHealth };
}

/** Checks the dependencies App B needs to do useful work. */
async function readiness(server: FastifyInstance): Promise<ReadinessBody> {
  const database = await pingComponent(server.db.$queryRaw`SELECT 1`);
  return {
    status: database.ok ? "ok" : "degraded",
    checks: { database },
  };
}

export async function healthRoutes(server: FastifyInstance): Promise<void> {
  // Liveness: the process can respond at all — no dependency checks.
  server.get("/health/live", { logLevel: "silent" }, async () => ({ status: "ok" }));

  // Readiness: reports which component failed, without sensitive internals.
  server.get("/health/ready", { logLevel: "silent" }, async (_request, reply) => {
    const body = await readiness(server);
    return reply.status(body.status === "ok" ? 200 : 503).send(body);
  });

  // Backward-compatible alias (was a plain liveness probe); now readiness.
  server.get("/health", { logLevel: "silent" }, async (_request, reply) => {
    const body = await readiness(server);
    return reply.status(body.status === "ok" ? 200 : 503).send(body);
  });
}
