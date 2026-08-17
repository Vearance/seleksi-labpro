import type { Prisma } from "@sso/db";

/**
 * A client with the model delegates but no client-management methods — accepts
 * both a `PrismaClient` and a `Prisma.TransactionClient` (for use inside `$transaction`).
 */
type DbClient = Prisma.TransactionClient;

/**
 * Revokes a single central session by id. Only touches sessions still marked
 * ACTIVE so the call is idempotent and does not overwrite an earlier revoke.
 * Returns true when a session was actually revoked.
 */
export async function revokeSession(
  db: DbClient,
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
  db: DbClient,
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
