import type { FastifyInstance } from "fastify";
import { requireAdmin } from "../../plugins/admin-auth.js";

export async function adminMeRoutes(server: FastifyInstance): Promise<void> {
  server.get("/me", { preHandler: requireAdmin }, async (request) => {
    return { userId: request.adminUserId };
  });
}
