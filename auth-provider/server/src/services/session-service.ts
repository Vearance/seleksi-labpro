import type { PrismaClient } from "@sso/db";
import { randomToken, sha256Hex, type UserStatus } from "@sso/shared";

export interface SessionLike {
  status: "ACTIVE" | "REVOKED" | "EXPIRED";
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface CreateSessionInput {
  userId: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  ttlSeconds: number;
}

export interface CreatedSession {
  sessionId: string;
  token: string;
}

/**
 * Creates a central session row. The raw token goes into the cookie; only its
 * sha256 hash is stored at rest (`sso_sessions.session_token_hash`).
 */
export async function createSession(db: PrismaClient, input: CreateSessionInput): Promise<CreatedSession> {
  const token = randomToken(32);
  const sessionTokenHash = sha256Hex(token);
  const expiresAt = new Date(Date.now() + input.ttlSeconds * 1000);

  const session = await db.ssoSession.create({
    data: {
      userId: input.userId,
      sessionTokenHash,
      status: "ACTIVE",
      userAgent: input.userAgent ?? null,
      ipAddress: input.ipAddress ?? null,
      expiresAt,
    },
  });

  return { sessionId: session.id, token };
}

/**
 * Central session validity rule: user active AND session active
 * AND not expired AND not revoked.
 */
export function isSessionValid(session: SessionLike, userStatus: UserStatus): boolean {
  if (userStatus !== "ACTIVE") return false;
  if (session.status !== "ACTIVE") return false;
  if (session.revokedAt !== null) return false;
  if (session.expiresAt.getTime() <= Date.now()) return false;
  return true;
}

/** Looks up a session by its raw token (hashed before the DB lookup). */
export async function getSessionByToken(db: PrismaClient, token: string) {
  return db.ssoSession.findUnique({ where: { sessionTokenHash: sha256Hex(token) } });
}

export interface ValidSession {
  session: { id: string; userId: string };
  user: { id: string; status: UserStatus };
}

/** Resolves a token to a valid (session, user) pair, or null. */
export async function getValidSession(db: PrismaClient, token: string): Promise<ValidSession | null> {
  const session = await getSessionByToken(db, token);
  if (!session) return null;

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, status: true },
  });
  if (!user) return null;

  if (!isSessionValid(session, user.status)) return null;

  return {
    session: { id: session.id, userId: session.userId },
    user: { id: user.id, status: user.status },
  };
}
