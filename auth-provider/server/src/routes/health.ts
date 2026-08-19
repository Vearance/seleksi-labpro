import type { FastifyInstance } from "fastify";
import { pingComponent, type ComponentHealth } from "@sso/shared";

interface ReadinessBody {
  status: "ok" | "degraded";
  checks: { database: ComponentHealth; broker: ComponentHealth };
}

/** Checks the dependencies the auth-server needs to do useful work. */
async function readiness(server: FastifyInstance): Promise<ReadinessBody> {
  const [database, broker] = await Promise.all([
    pingComponent(server.db.$queryRaw`SELECT 1`),
    pingComponent(server.metrics.pingBroker()),
  ]);
  return {
    status: database.ok && broker.ok ? "ok" : "degraded",
    checks: { database, broker },
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

  server.get("/health", { logLevel: "silent" }, async (_request, reply) => {
    const body = await readiness(server);
    return reply.status(body.status === "ok" ? 200 : 503).send(body);
  });
}
