import type { FastifyInstance } from "fastify";
import { COOKIE_NAMES } from "@sso/shared";
import { buildEventEnvelope, writeOutboxEvent } from "../lib/outboxWriter.js";
import * as auditService from "../services/audit-service.js";
import * as revocationService from "../services/revocation-service.js";
import * as sessionService from "../services/session-service.js";

export async function logoutRoutes(server: FastifyInstance): Promise<void> {
  server.post("/logout", async (request, reply) => {
    const token = request.cookies[COOKIE_NAMES.authSession];
    let revoked = false;
    let userId: string | null = null;
    let sessionId: string | null = null;

    if (token) {
      const session = await sessionService.getSessionByToken(server.db, token);
      if (session) {
        userId = session.userId;
        sessionId = session.id;

        // Revoke + emit SessionRevoked atomically (transactional outbox).
        revoked = await server.db.$transaction(async (tx) => {
          const didRevoke = await revocationService.revokeSession(tx, session.id, "sso_logout");
          if (didRevoke) {
            await writeOutboxEvent(
              tx,
              buildEventEnvelope({
                eventType: "SessionRevoked",
                userId: session.userId,
                centralSessionId: session.id,
                reason: "sso_logout",
              }),
            );
          }
          return didRevoke;
        });
      }
    }

    if (revoked) {
      await auditService.writeAudit(server.db, {
        eventType: "logout",
        userId,
        sessionId,
        result: "success",
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
      });
    }

    // Always clear the cookie so logout is idempotent even without a valid session.
    reply.clearCookie(COOKIE_NAMES.authSession, { path: "/" });
    return { success: true };
  });
}
