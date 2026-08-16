import type { PrismaClient } from "@sso/db-local";
import { randomToken } from "@sso/shared";

const STATE_TTL_SECONDS = 300; // 5 min, matches the authorization code TTL

export interface CreateOAuthStateInput {
  applicationId: string;
  codeVerifier: string;
  ttlSeconds?: number;
}

export interface CreatedOAuthState {
  state: string;
}

/** Persists the login-flow `state` + its PKCE verifier until the callback. */
export async function createOAuthState(
  db: PrismaClient,
  input: CreateOAuthStateInput,
): Promise<CreatedOAuthState> {
  const state = randomToken(32);
  const expiresAt = new Date(Date.now() + (input.ttlSeconds ?? STATE_TTL_SECONDS) * 1000);

  await db.oAuthState.create({
    data: {
      applicationId: input.applicationId,
      state,
      codeVerifier: input.codeVerifier,
      expiresAt,
    },
  });

  return { state };
}

export interface ConsumedOAuthState {
  codeVerifier: string;
}

/**
 * Validates and atomically consumes a state (single-use). Returns null for an
 * unknown, wrong-app, expired, or already-consumed state.
 */
export async function consumeOAuthState(
  db: PrismaClient,
  state: string,
  applicationId: string,
): Promise<ConsumedOAuthState | null> {
  const row = await db.oAuthState.findUnique({ where: { state } });
  if (!row || row.applicationId !== applicationId) return null;
  if (row.consumedAt !== null) return null;
  if (row.expiresAt.getTime() <= Date.now()) return null;

  const consumed = await db.oAuthState.updateMany({
    where: { id: row.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (consumed.count !== 1) return null;

  return { codeVerifier: row.codeVerifier };
}
