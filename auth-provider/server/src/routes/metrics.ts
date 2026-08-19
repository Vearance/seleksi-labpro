import type { FastifyInstance } from "fastify";
import { requireAdmin } from "../plugins/admin-auth.js";

export async function metricsRoutes(server: FastifyInstance): Promise<void> {
  // Prometheus text exposition — scrape target for an external Prometheus.
  server.get("/metrics", { logLevel: "silent" }, async (_request, reply) => {
    reply.type("text/plain");
    return server.metrics.registry.metrics();
  });

  // JSON snapshot for the control-panel dashboard (reached via the
  // control-panel /admin/* proxy, so it requires the admin session).
  server.get("/admin/metrics/snapshot", { preHandler: requireAdmin }, async () => {
    return server.metrics.snapshot();
  });
}
