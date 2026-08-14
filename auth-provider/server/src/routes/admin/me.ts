import type { FastifyInstance } from "fastify";
import { requireAdmin } from "../../plugins/admin-auth.js";

export async function adminMeRoutes(server: FastifyInstance): Promise<void> {
  server.get("/me", { preHandler: requireAdmin }, async (request) => {
    const user = await server.db.user.findUnique({ where: { id: request.adminUserId! } });
    return { id: user!.id, name: user!.name, email: user!.email };
  });
}
