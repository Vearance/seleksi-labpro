import type { PrismaClient } from "@sso/db";
import { randomToken, sha256Hex } from "@sso/shared";

/** 5 minutes */
export const CODE_TTL_SECONDS = 300;

export interface IssueCodeInput {
  userId: string;
  applicationId: string;
  ssoSessionId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
}

/**
 * Issues a one-time authorization code. The raw code is returned (to put in
 * the redirect URL); only its sha256 hash is stored at rest, bound to the
 * user + application + central session + redirect_uri + PKCE challenge.
 */
export async function issueAuthorizationCode(
  db: PrismaClient,
  input: IssueCodeInput,
): Promise<{ code: string }> {
  const code = randomToken(32);
  const codeHash = sha256Hex(code);
  const expiresAt = new Date(Date.now() + CODE_TTL_SECONDS * 1000);

  await db.authorizationCode.create({
    data: {
      codeHash,
      applicationId: input.applicationId,
      userId: input.userId,
      ssoSessionId: input.ssoSessionId,
      codeChallenge: input.codeChallenge,
      codeChallengeMethod: input.codeChallengeMethod,
      redirectUri: input.redirectUri,
      expiresAt,
    },
  });

  return { code };
}
