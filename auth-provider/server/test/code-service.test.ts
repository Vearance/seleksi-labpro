import { describe, expect, it, vi } from "vitest";
import { sha256Hex } from "@sso/shared";
import { CODE_TTL_SECONDS, issueAuthorizationCode } from "../src/services/code-service.js";

function mockDb() {
  return {
    authorizationCode: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "code-id", ...data })),
    },
  } as never;
}

describe("issueAuthorizationCode", () => {
  it("stores a hash (not the raw code) and binds it to user/app/session/URI/PKCE", async () => {
    const db = mockDb();
    const { code } = await issueAuthorizationCode(db, {
      userId: "u1",
      applicationId: "a1",
      ssoSessionId: "s1",
      redirectUri: "http://localhost:4001/callback",
      codeChallenge: "challenge",
      codeChallengeMethod: "S256",
    });

    const create = (db as { authorizationCode: { create: ReturnType<typeof vi.fn> } })
      .authorizationCode.create;
    const data = create.mock.calls[0]![0].data as Record<string, unknown>;

    expect(code).toBeTruthy();
    expect(data.codeHash).not.toBe(code);
    expect(data.codeHash).toBe(sha256Hex(code));
    expect(data).toMatchObject({
      applicationId: "a1",
      userId: "u1",
      ssoSessionId: "s1",
      redirectUri: "http://localhost:4001/callback",
      codeChallenge: "challenge",
      codeChallengeMethod: "S256",
    });
    expect((data.expiresAt as Date).getTime()).toBeGreaterThan(Date.now());
    expect((data.expiresAt as Date).getTime()).toBeLessThanOrEqual(Date.now() + CODE_TTL_SECONDS * 1000);
  });
});
