import type { FastifyInstance } from "fastify";
import { ApiError, COOKIE_NAMES } from "@sso/shared";
import { getLocalSessionByToken, isLocalSessionValid } from "../services/local-session-service.js";

const APPLICATION_ID = "app-b";

function normalizeGroups(groups: unknown): string[] {
  if (!Array.isArray(groups)) return [];
  return groups.filter((g): g is string => typeof g === "string");
}

function requireLocalSession(server: FastifyInstance, token: string | undefined) {
  if (!token) return null;
  return getLocalSessionByToken(server.db, token);
}

export async function apiRoutes(server: FastifyInstance): Promise<void> {
  server.get("/api/me", async (request) => {
    const session = await requireLocalSession(server, request.cookies[COOKIE_NAMES.appB]);
    if (!session || !isLocalSessionValid(session)) {
      throw new ApiError("Unauthorized", { statusCode: 401, code: "UNAUTHORIZED" });
    }

    const profile = await server.db.profileCache.findUnique({
      where: { externalUserId: session.externalUserId },
    });
    if (!profile) {
      throw new ApiError("Unauthorized", { statusCode: 401, code: "UNAUTHORIZED" });
    }

    return {
      user: {
        name: profile.name,
        email: profile.email,
        groups: normalizeGroups(profile.groups),
      },
      session: {
        status: session.status,
        createdAt: session.createdAt.toISOString(),
        expiresAt: session.expiresAt.toISOString(),
      },
    };
  });

  server.get("/api/activity-log", async (request) => {
    const session = await requireLocalSession(server, request.cookies[COOKIE_NAMES.appB]);
    if (!session || !isLocalSessionValid(session)) {
      throw new ApiError("Unauthorized", { statusCode: 401, code: "UNAUTHORIZED" });
    }

    const entries = await server.db.activityLog.findMany({
      where: { applicationId: APPLICATION_ID },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return {
      entries: entries.map((entry) => ({
        id: entry.id,
        event: entry.event,
        correlationId: entry.correlationId,
        createdAt: entry.createdAt.toISOString(),
      })),
    };
  });

  server.get("/api/processed-events", async (request) => {
    const session = await requireLocalSession(server, request.cookies[COOKIE_NAMES.appB]);
    if (!session || !isLocalSessionValid(session)) {
      throw new ApiError("Unauthorized", { statusCode: 401, code: "UNAUTHORIZED" });
    }

    const events = await server.db.processedEvent.findMany({
      where: { applicationId: APPLICATION_ID },
      orderBy: { processedAt: "desc" },
      take: 50,
    });

    return {
      events: events.map((event) => ({
        eventId: event.eventId,
        eventType: event.eventType,
        processedAt: event.processedAt.toISOString(),
        result: event.result,
      })),
    };
  });

  server.post("/api/logout", async (request, reply) => {
    const session = await requireLocalSession(server, request.cookies[COOKIE_NAMES.appB]);
    if (session) {
      await server.db.localSession.updateMany({
        where: { id: session.id, status: "ACTIVE" },
        data: { status: "REVOKED", revokedAt: new Date(), revokeReason: "local_logout" },
      });
    }

    reply.clearCookie(COOKIE_NAMES.appB, { path: "/" });
    return { success: true };
  });
}
