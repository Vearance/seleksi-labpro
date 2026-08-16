import type { PrismaClient } from "@sso/db-local";
import { randomToken, sha256Hex } from "@sso/shared";

export interface CreateLocalSessionInput {
  applicationId: string;
  externalUserId: string;
  centralSessionId: string;
  ttlSeconds: number;
}

export interface CreatedLocalSession {
  sessionId: string;
  token: string;
}

/**
 * Creates a local session row. The raw token goes into the cookie; only its
 * sha256 hash is stored at rest.
 */
export async function createLocalSession(
  db: PrismaClient,
  input: CreateLocalSessionInput,
): Promise<CreatedLocalSession> {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + input.ttlSeconds * 1000);

  const session = await db.localSession.create({
    data: {
      sessionTokenHash: sha256Hex(token),
      externalUserId: input.externalUserId,
      centralSessionId: input.centralSessionId,
      applicationId: input.applicationId,
      status: "ACTIVE",
      expiresAt,
    },
  });

  return { sessionId: session.id, token };
}

export interface ProfileCacheInput {
  externalUserId: string;
  name: string;
  email: string;
  groups: string[];
}

/** Creates or refreshes the cached profile for a provider user. */
export async function upsertProfileCache(
  db: PrismaClient,
  profile: ProfileCacheInput,
): Promise<void> {
  const syncedAt = new Date();

  await db.profileCache.upsert({
    where: { externalUserId: profile.externalUserId },
    create: {
      externalUserId: profile.externalUserId,
      name: profile.name,
      email: profile.email,
      groups: profile.groups,
      syncedAt,
    },
    update: {
      name: profile.name,
      email: profile.email,
      groups: profile.groups,
      syncedAt,
    },
  });
}

export interface LocalSessionLike {
  status: "ACTIVE" | "EXPIRED" | "REVOKED";
  expiresAt: Date;
  revokedAt: Date | null;
}

/** Local session valid iff: active, not revoked, not expired. */
export function isLocalSessionValid(session: LocalSessionLike): boolean {
  if (session.status !== "ACTIVE") return false;
  if (session.revokedAt !== null) return false;
  if (session.expiresAt.getTime() <= Date.now()) return false;
  return true;
}

/** Looks up a local session by its raw cookie token (hashed before lookup). */
export async function getLocalSessionByToken(db: PrismaClient, token: string) {
  return db.localSession.findUnique({ where: { sessionTokenHash: sha256Hex(token) } });
}
