import type { FastifyInstance } from "fastify";
import { COOKIE_NAMES } from "@sso/shared";
import * as auditService from "../services/audit-service.js";
import * as revocationService from "../services/revocation-service.js";
import * as sessionService from "../services/session-service.js";

export async function logoutRoutes(server: FastifyInstance): Promise<void> {
  server.post("/logout", async (request, reply) => {
    const token = request.cookies[COOKIE_NAMES.authSession];

    if (token) {
      const session = await sessionService.getSessionByToken(server.db, token);
      if (session) {
        const revoked = await revocationService.revokeSession(server.db, session.id, "sso_logout");
        if (revoked) {
          await auditService.writeAudit(server.db, {
            eventType: "logout",
            userId: session.userId,
            sessionId: session.id,
            result: "success",
            ipAddress: request.ip,
            userAgent: request.headers["user-agent"],
          });
        }
      }
    }

    // Always clear the cookie so logout is idempotent even without a valid session.
    reply.clearCookie(COOKIE_NAMES.authSession, { path: "/" });
    return { success: true };
  });
}
