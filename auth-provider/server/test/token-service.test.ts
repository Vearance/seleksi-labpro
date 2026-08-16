import { describe, expect, it, vi } from "vitest";
import { hashPassword, sha256Base64Url, sha256Hex, verifyPkce } from "@sso/shared";
import {
  OAuthError,
  exchangeAuthorizationCode,
  getUserInfo,
} from "../src/services/token-service.js";

const future = new Date(Date.now() + 60_000);
const past = new Date(Date.now() - 60_000);

function buildCodeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "code-id",
    applicationId: "app-id",
    userId: "user-id",
    ssoSessionId: "session-id",
    codeChallenge: sha256Base64Url("verifier-123"),
    codeChallengeMethod: "S256",
    redirectUri: "http://localhost:4001/callback",
    expiresAt: future,
    consumedAt: null,
    application: { clientId: "app-a-client", clientSecretHash: "ignored", status: "ACTIVE" },
    ...overrides,
  };
}

describe("verifyPkce", () => {
  it("accepts a valid S256 verifier", () => {
    const challenge = sha256Base64Url("verifier-123");
    expect(verifyPkce(challenge, "verifier-123", "S256")).toBe(true);
  });

  it("rejects a mismatched S256 verifier", () => {
    const challenge = sha256Base64Url("verifier-123");
    expect(verifyPkce(challenge, "other-verifier", "S256")).toBe(false);
  });

  it("supports plain method", () => {
    expect(verifyPkce("plain-challenge", "plain-challenge", "plain")).toBe(true);
    expect(verifyPkce("plain-challenge", "wrong", "plain")).toBe(false);
  });
});

describe("exchangeAuthorizationCode", () => {
  it("issues an opaque token bound to app + session and consumes the code", async () => {
    const appSecretHash = await hashPassword("app-secret");
    const codeRow = buildCodeRow({ application: { clientId: "app-a-client", clientSecretHash: appSecretHash, status: "ACTIVE" } });

    const updateMany = vi.fn(async (_args: { where: Record<string, unknown>; data: Record<string, unknown> }) => ({ count: 1 }));
    const create = vi.fn(async (args: { data: Record<string, unknown> }) => ({ id: "token-id", ...args.data }));
    const tx = {
      authorizationCode: { updateMany },
      accessToken: { create },
    };
    const db = {
      authorizationCode: { findUnique: vi.fn(async () => codeRow) },
      ssoSession: { findUnique: vi.fn(async () => ({ status: "ACTIVE", expiresAt: future, revokedAt: null })) },
      user: { findUnique: vi.fn(async () => ({ status: "ACTIVE" })) },
      $transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
    } as never;

    const result = await exchangeAuthorizationCode(
      db,
      {
        code: "raw-code",
        clientId: "app-a-client",
        clientSecret: "app-secret",
        redirectUri: "http://localhost:4001/callback",
        codeVerifier: "verifier-123",
      },
      3600,
    );

    expect(result.accessToken).toBeTruthy();
    expect(result.tokenType).toBe("Bearer");
    expect(result.expiresIn).toBe(3600);
    expect(result.applicationId).toBe("app-id");
    expect(result.userId).toBe("user-id");
    expect(result.sessionId).toBe("session-id");

    const consume = updateMany.mock.calls[0]![0];
    expect(consume.where).toEqual({ id: "code-id", consumedAt: null });

    const createArgs = create.mock.calls[0]![0];
    expect(createArgs.data.tokenHash).toBe(sha256Hex(result.accessToken));
    expect(createArgs.data.applicationId).toBe("app-id");
    expect(createArgs.data.userId).toBe("user-id");
    expect(createArgs.data.ssoSessionId).toBe("session-id");
  });

  it("rejects a replayed (already consumed) code", async () => {
    const appSecretHash = await hashPassword("app-secret");
    const codeRow = buildCodeRow({
      consumedAt: past,
      application: { clientId: "app-a-client", clientSecretHash: appSecretHash, status: "ACTIVE" },
    });
    const db = {
      authorizationCode: { findUnique: vi.fn(async () => codeRow) },
      ssoSession: { findUnique: vi.fn(async () => null) },
      user: { findUnique: vi.fn(async () => null) },
      $transaction: vi.fn(),
    } as never;

    await expect(
      exchangeAuthorizationCode(
        db,
        { code: "raw-code", clientId: "app-a-client", clientSecret: "app-secret", codeVerifier: "verifier-123" },
        3600,
      ),
    ).rejects.toMatchObject({ error: "invalid_grant" });
  });

  it("rejects a PKCE mismatch", async () => {
    const appSecretHash = await hashPassword("app-secret");
    const codeRow = buildCodeRow({
      application: { clientId: "app-a-client", clientSecretHash: appSecretHash, status: "ACTIVE" },
    });
    const db = {
      authorizationCode: { findUnique: vi.fn(async () => codeRow) },
      ssoSession: { findUnique: vi.fn(async () => null) },
      user: { findUnique: vi.fn(async () => null) },
      $transaction: vi.fn(),
    } as never;

    await expect(
      exchangeAuthorizationCode(
        db,
        { code: "raw-code", clientId: "app-a-client", clientSecret: "app-secret", codeVerifier: "wrong-verifier" },
        3600,
      ),
    ).rejects.toMatchObject({ error: "invalid_grant" });
  });

  it("rejects an expired code", async () => {
    const appSecretHash = await hashPassword("app-secret");
    const codeRow = buildCodeRow({
      expiresAt: past,
      application: { clientId: "app-a-client", clientSecretHash: appSecretHash, status: "ACTIVE" },
    });
    const db = {
      authorizationCode: { findUnique: vi.fn(async () => codeRow) },
      ssoSession: { findUnique: vi.fn(async () => null) },
      user: { findUnique: vi.fn(async () => null) },
      $transaction: vi.fn(),
    } as never;

    await expect(
      exchangeAuthorizationCode(
        db,
        { code: "raw-code", clientId: "app-a-client", clientSecret: "app-secret", codeVerifier: "verifier-123" },
        3600,
      ),
    ).rejects.toMatchObject({ error: "invalid_grant" });
  });

  it("rejects a wrong client secret", async () => {
    const appSecretHash = await hashPassword("app-secret");
    const codeRow = buildCodeRow({
      application: { clientId: "app-a-client", clientSecretHash: appSecretHash, status: "ACTIVE" },
    });
    const db = {
      authorizationCode: { findUnique: vi.fn(async () => codeRow) },
      ssoSession: { findUnique: vi.fn(async () => null) },
      user: { findUnique: vi.fn(async () => null) },
      $transaction: vi.fn(),
    } as never;

    await expect(
      exchangeAuthorizationCode(
        db,
        { code: "raw-code", clientId: "app-a-client", clientSecret: "wrong", codeVerifier: "verifier-123" },
        3600,
      ),
    ).rejects.toMatchObject({ error: "invalid_client" });
  });

  it("throws OAuthError (not a generic Error)", async () => {
    const db = { authorizationCode: { findUnique: vi.fn(async () => null) } } as never;
    try {
      await exchangeAuthorizationCode(db, { code: "nope", clientId: "app-a-client" }, 3600);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(OAuthError);
      expect((err as OAuthError).error).toBe("invalid_grant");
    }
  });
});

describe("getUserInfo", () => {
  it("returns name/email/groups for a valid token", async () => {
    const db = {
      accessToken: {
        findUnique: vi.fn(async () => ({
          userId: "user-id",
          ssoSessionId: "session-id",
          status: "ACTIVE",
          revokedAt: null,
          expiresAt: future,
          user: {
            status: "ACTIVE",
            name: "Alice",
            email: "alice@example.com",
            groups: [
              { group: { name: "employees" } },
              { group: { name: "contractors" } },
            ],
          },
        })),
      },
    } as never;

    const info = await getUserInfo(db, "raw-token");
    expect(info).toEqual({
      sub: "user-id",
      sid: "session-id",
      name: "Alice",
      email: "alice@example.com",
      groups: ["contractors", "employees"],
    });
  });

  it("returns null for an expired token", async () => {
    const db = {
      accessToken: {
        findUnique: vi.fn(async () => ({
          userId: "user-id",
          status: "ACTIVE",
          revokedAt: null,
          expiresAt: past,
          user: { status: "ACTIVE", name: "Alice", email: "alice@example.com", groups: [] },
        })),
      },
    } as never;

    expect(await getUserInfo(db, "raw-token")).toBeNull();
  });
});
