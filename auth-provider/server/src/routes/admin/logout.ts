import type { FastifyInstance } from "fastify";
import { COOKIE_NAMES } from "@sso/shared";

/** Clears the admin session cookie (the signed cookie is the only state). */
export async function adminLogoutRoutes(server: FastifyInstance): Promise<void> {
  server.post("/logout", async (request, reply) => {
    reply.clearCookie(COOKIE_NAMES.adminSession, { path: "/" });
    return { success: true };
  });
}
