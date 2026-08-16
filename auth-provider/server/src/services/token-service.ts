import type { PrismaClient } from "@sso/db";
import { randomToken, sha256Hex, verifyPassword, verifyPkce } from "@sso/shared";
import { isSessionValid } from "./session-service.js";

/**
 * OAuth 2.0 token-endpoint error. Distinct from `ApiError`.
 */
export class OAuthError extends Error {
  readonly error: string;
  readonly statusCode: number;

  constructor(error: string, description: string, statusCode = 400) {
    super(description);
    this.name = "OAuthError";
    this.error = error;
    this.statusCode = statusCode;
  }
}

export interface TokenExchangeInput {
  code?: string;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  codeVerifier?: string;
}

export interface TokenExchangeResult {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  userId: string;
  applicationId: string;
  sessionId: string;
}

/**
 * Exchanges a one-time authorization code for an opaque access token.
 *
 * Rejection rules (spec `authorization_codes` + OAuth):
 *   - unknown / used / expired code -> `invalid_grant`
 *   - code issued to another client -> `invalid_grant`
 *   - wrong client secret -> `invalid_client`
 *   - PKCE mismatch -> `invalid_grant`
 *   - redirect_uri mismatch -> `invalid_grant`
 *   - central session no longer valid -> `invalid_grant`
 *
 * The code is consumed atomically via `updateMany({ consumedAt: null })`; the
 * consume + token insert run in one transaction so a failed insert rolls back
 * the consumption (no lost code).
 */
export async function exchangeAuthorizationCode(
  db: PrismaClient,
  input: TokenExchangeInput,
  accessTokenTtlSeconds: number,
): Promise<TokenExchangeResult> {
  if (!input.code) throw new OAuthError("invalid_request", "code is required");
  if (!input.clientId) throw new OAuthError("invalid_request", "client_id is required");

  const codeRow = await db.authorizationCode.findUnique({
    where: { codeHash: sha256Hex(input.code) },
    include: { application: true },
  });

  if (!codeRow) throw new OAuthError("invalid_grant", "authorization code not found");

  if (codeRow.application.clientId !== input.clientId) {
    throw new OAuthError("invalid_grant", "authorization code was issued to another client");
  }

  const secretOk = await verifyPassword(codeRow.application.clientSecretHash, input.clientSecret ?? "");
  if (!secretOk) {
    throw new OAuthError("invalid_client", "client authentication failed", 401);
  }

  if (codeRow.application.status !== "ACTIVE") {
    throw new OAuthError("invalid_grant", "application is inactive");
  }
  if (codeRow.consumedAt !== null) {
    throw new OAuthError("invalid_grant", "authorization code already used");
  }
  if (codeRow.expiresAt.getTime() <= Date.now()) {
    throw new OAuthError("invalid_grant", "authorization code expired");
  }
  if (!input.codeVerifier || !verifyPkce(codeRow.codeChallenge, input.codeVerifier, codeRow.codeChallengeMethod)) {
    throw new OAuthError("invalid_grant", "PKCE verification failed");
  }
  if (input.redirectUri && codeRow.redirectUri !== input.redirectUri) {
    throw new OAuthError("invalid_grant", "redirect_uri does not match");
  }

  const session = await db.ssoSession.findUnique({ where: { id: codeRow.ssoSessionId } });
  const user = await db.user.findUnique({ where: { id: codeRow.userId } });
  if (!session || !user) {
    throw new OAuthError("invalid_grant", "central session no longer valid");
  }
  if (!isSessionValid(session, user.status)) {
    throw new OAuthError("invalid_grant", "central session no longer valid");
  }

  const issued = await db.$transaction(async (tx) => {
    const consumed = await tx.authorizationCode.updateMany({
      where: { id: codeRow.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (consumed.count !== 1) {
      throw new OAuthError("invalid_grant", "authorization code already used");
    }

    const rawToken = randomToken(32);
    const expiresAt = new Date(Date.now() + accessTokenTtlSeconds * 1000);

    await tx.accessToken.create({
      data: {
        tokenHash: sha256Hex(rawToken),
        applicationId: codeRow.applicationId,
        userId: codeRow.userId,
        ssoSessionId: codeRow.ssoSessionId,
        scope: null,
        status: "ACTIVE",
        expiresAt,
      },
    });

    return { rawToken };
  });

  return {
    accessToken: issued.rawToken,
    tokenType: "Bearer",
    expiresIn: accessTokenTtlSeconds,
    userId: codeRow.userId,
    applicationId: codeRow.applicationId,
    sessionId: codeRow.ssoSessionId,
  };
}

export interface UserInfo {
  sub: string;
  name: string;
  email: string;
  groups: string[];
}

/**
 * Resolves an access token to the owner's profile. Returns null for missing,
 * expired, revoked, or non-active-user tokens.
 */
export async function getUserInfo(db: PrismaClient, rawToken: string): Promise<UserInfo | null> {
  const token = await db.accessToken.findUnique({
    where: { tokenHash: sha256Hex(rawToken) },
    include: {
      user: {
        include: { groups: { include: { group: { select: { name: true } } } } },
      },
    },
  });

  if (!token) return null;
  if (token.status !== "ACTIVE" || token.revokedAt !== null) return null;
  if (token.expiresAt.getTime() <= Date.now()) return null;
  if (token.user.status !== "ACTIVE") return null;

  return {
    sub: token.userId,
    name: token.user.name,
    email: token.user.email,
    groups: token.user.groups.map((membership) => membership.group.name).sort(),
  };
}
