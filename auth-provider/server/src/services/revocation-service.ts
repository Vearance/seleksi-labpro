import type { PrismaClient } from "@sso/db";

/**
 * Revokes a single central session by id. Only touches sessions still marked
 * ACTIVE so the call is idempotent and does not overwrite an earlier revoke.
 * Returns true when a session was actually revoked.
 */
export async function revokeSession(
  db: PrismaClient,
  sessionId: string,
  reason: string,
): Promise<boolean> {
  const result = await db.ssoSession.updateMany({
    where: { id: sessionId, status: "ACTIVE" },
    data: {
      status: "REVOKED",
      revokedAt: new Date(),
      revokeReason: reason,
    },
  });
  return result.count === 1;
}

/**
 * Revokes every active central session owned by a user. Used by later triggers
 * (password change, user deactivation, policy change). Returns the number of
 * sessions revoked.
 */
export async function revokeSessionsForUser(
  db: PrismaClient,
  userId: string,
  reason: string,
): Promise<number> {
  const result = await db.ssoSession.updateMany({
    where: { userId, status: "ACTIVE" },
    data: {
      status: "REVOKED",
      revokedAt: new Date(),
      revokeReason: reason,
    },
  });
  return result.count;
}
