import type { Prisma } from "@sso/db";

/**
 * A client with the model delegates but no client-management methods — accepts
 * both a `PrismaClient` and a `Prisma.TransactionClient` (for use inside `$transaction`).
 */
type DbClient = Prisma.TransactionClient;

/** Marks ACTIVE sessions matching `where` as REVOKED. Returns the count. */
async function revokeSessionsWhere(
  db: DbClient,
  where: Prisma.SsoSessionWhereInput,
  reason: string,
): Promise<number> {
  const result = await db.ssoSession.updateMany({
    where: { ...where, status: "ACTIVE" },
    data: {
      status: "REVOKED",
      revokedAt: new Date(),
      revokeReason: reason,
    },
  });
  return result.count;
}

/**
 * Revokes ACTIVE access tokens linked to the given sessions. Tokens are bound
 * to their issuing central session (spec), so revoking a session must also
 * invalidate its tokens — `/userinfo` already rejects non-ACTIVE tokens.
 */
async function revokeTokensLinkedToSessions(db: DbClient, sessionIds: string[]): Promise<number> {
  if (sessionIds.length === 0) return 0;
  const result = await db.accessToken.updateMany({
    where: {
      ssoSessionId: { in: sessionIds },
      status: "ACTIVE",
    },
    data: {
      status: "REVOKED",
      revokedAt: new Date(),
    },
  });
  return result.count;
}

/**
 * Revokes a single central session by id (and its access tokens). Only touches
 * sessions still marked ACTIVE so the call is idempotent and does not overwrite
 * an earlier revoke. Returns true when a session was actually revoked.
 */
export async function revokeSession(
  db: DbClient,
  sessionId: string,
  reason: string,
): Promise<boolean> {
  const revoked = await revokeSessionsWhere(db, { id: sessionId }, reason);
  if (revoked > 0) {
    await revokeTokensLinkedToSessions(db, [sessionId]);
  }
  return revoked === 1;
}

/**
 * Revokes every active central session owned by a user (and their access
 * tokens). Used by later triggers (password change, user deactivation, policy
 * change). Returns the number of sessions revoked.
 */
export async function revokeSessionsForUser(
  db: DbClient,
  userId: string,
  reason: string,
): Promise<number> {
  const sessions = await db.ssoSession.findMany({
    where: { userId, status: "ACTIVE" },
    select: { id: true },
  });
  const revoked = await revokeSessionsWhere(db, { userId }, reason);
  if (revoked > 0) {
    await revokeTokensLinkedToSessions(
      db,
      sessions.map((session) => session.id),
    );
  }
  return revoked;
}
