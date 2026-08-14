import type { FastifyInstance } from "fastify";
import { ApiError, COOKIE_NAMES } from "@sso/shared";
import { authenticateAdmin } from "../../services/admin-service.js";

export async function adminLoginRoutes(server: FastifyInstance): Promise<void> {
  server.post(
    "/login",
    {
      schema: {
        body: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string" },
            password: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body as { email: string; password: string };
      const admin = await authenticateAdmin(server.db, email, password);

      if (!admin) {
        throw new ApiError("Invalid credentials", { statusCode: 401, code: "UNAUTHORIZED" });
      }

      const ttlSeconds = server.config.ADMIN_SESSION_TTL_SECONDS;
      const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
      const payload = JSON.stringify({ userId: admin.id, exp });

      reply.setCookie(COOKIE_NAMES.adminSession, payload, {
        signed: true,
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: ttlSeconds,
      });

      return { id: admin.id, name: admin.name, email: admin.email };
    },
  );
}
