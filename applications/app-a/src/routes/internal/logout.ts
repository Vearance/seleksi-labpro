import type { FastifyInstance } from "fastify";
import { EventEnvelopeSchema, verifyInternalAuth } from "@sso/shared";
import * as eventDedupeService from "../../services/event-dedupe-service.js";

const APPLICATION_ID = "app-a";

const DEFAULT_REVOKE_REASONS: Record<string, string> = {
  SessionRevoked: "sso_logout",
  PasswordChanged: "password_changed",
  AccessPolicyChanged: "policy_changed",
};

export async function internalLogoutRoutes(server: FastifyInstance): Promise<void> {
  server.post("/internal/logout", async (request, reply) => {
    const signature = request.headers["x-internal-signature"];
    const timestamp = request.headers["x-internal-timestamp"];

    if (typeof signature !== "string" || typeof timestamp !== "string") {
      return reply.status(401).send({
        error: { code: "UNAUTHORIZED", message: "Missing signature", requestId: request.id },
      });
    }

    const ts = Number(timestamp);
    if (
      !Number.isFinite(ts) ||
      Math.abs(Math.floor(Date.now() / 1000) - ts) > server.config.INTERNAL_HMAC_TTL_SECONDS
    ) {
      return reply.status(401).send({
        error: { code: "UNAUTHORIZED", message: "Stale timestamp", requestId: request.id },
      });
    }

    const parsed = EventEnvelopeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: "Invalid event payload", requestId: request.id },
      });
    }
    const body = parsed.data;

    const valid = verifyInternalAuth(
      server.config.INTERNAL_HMAC_SECRET,
      timestamp,
      {
        eventId: body.eventId,
        eventType: body.eventType,
        userId: body.userId,
        centralSessionId: body.centralSessionId,
        reason: body.reason,
      },
      signature,
    );
    if (!valid) {
      return reply.status(401).send({
        error: { code: "UNAUTHORIZED", message: "Invalid signature", requestId: request.id },
      });
    }

    // Idempotency: skip if this event_id was already processed.
    const alreadyProcessed = await eventDedupeService.hasProcessedEvent(
      server.db,
      APPLICATION_ID,
      body.eventId,
    );
    if (alreadyProcessed) {
      return { success: true };
    }

    const revokeReason = body.reason ?? DEFAULT_REVOKE_REASONS[body.eventType] ?? "sso_logout";

    // Revoke + record atomically so a failed record is rolled back on retry.
    await server.db.$transaction(async (tx) => {
      if (body.centralSessionId) {
        await tx.localSession.updateMany({
          where: {
            applicationId: APPLICATION_ID,
            centralSessionId: body.centralSessionId,
            status: "ACTIVE",
          },
          data: { status: "REVOKED", revokedAt: new Date(), revokeReason },
        });
      } else {
        await tx.localSession.updateMany({
          where: { applicationId: APPLICATION_ID, externalUserId: body.userId, status: "ACTIVE" },
          data: { status: "REVOKED", revokedAt: new Date(), revokeReason },
        });
      }

      await tx.processedEvent.create({
        data: {
          applicationId: APPLICATION_ID,
          eventId: body.eventId,
          eventType: body.eventType,
          result: "local_session_revoked",
        },
      });
    });

    return { success: true };
  });
}
