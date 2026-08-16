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
