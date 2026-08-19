import { describe, expect, it, vi } from "vitest";
import { revokeSession, revokeSessionsForUser } from "../src/services/revocation-service.js";

describe("revokeSession", () => {
  it("marks the session REVOKED with a reason and timestamp, and revokes its access tokens", async () => {
    const updateMany = vi.fn(async (_args: { where: Record<string, unknown>; data: Record<string, unknown> }) => ({ count: 1 }));
    const tokenUpdateMany = vi.fn(
      async (_args: { where: Record<string, unknown>; data: Record<string, unknown> }) => ({ count: 1 }),
    );
    const db = {
      ssoSession: { updateMany },
      accessToken: { updateMany: tokenUpdateMany },
    } as never;

    const result = await revokeSession(db, "session-1", "sso_logout");

    expect(result).toBe(true);
    const args = updateMany.mock.calls[0]![0];
    expect(args.where).toEqual({ id: "session-1", status: "ACTIVE" });
    expect(args.data.status).toBe("REVOKED");
    expect(args.data.revokeReason).toBe("sso_logout");
    expect(args.data.revokedAt).toBeInstanceOf(Date);

    // Access tokens bound to the revoked session are revoked too.
    const tokenArgs = tokenUpdateMany.mock.calls[0]![0];
    expect(tokenArgs.where).toEqual({ ssoSessionId: { in: ["session-1"] }, status: "ACTIVE" });
    expect(tokenArgs.data.status).toBe("REVOKED");
    expect(tokenArgs.data.revokedAt).toBeInstanceOf(Date);
  });

  it("returns false when no active session was revoked and leaves tokens alone", async () => {
    const tokenUpdateMany = vi.fn(async () => ({ count: 0 }));
    const db = {
      ssoSession: { updateMany: vi.fn(async () => ({ count: 0 })) },
      accessToken: { updateMany: tokenUpdateMany },
    } as never;

    expect(await revokeSession(db, "session-1", "sso_logout")).toBe(false);
    expect(tokenUpdateMany).not.toHaveBeenCalled();
  });
});

describe("revokeSessionsForUser", () => {
  it("revokes every active session for the user and their access tokens, returns the count", async () => {
    const updateMany = vi.fn(async (_args: { where: Record<string, unknown>; data: Record<string, unknown> }) => ({ count: 3 }));
    const findMany = vi.fn(async () => [{ id: "s-1" }, { id: "s-2" }, { id: "s-3" }]);
    const tokenUpdateMany = vi.fn(
      async (_args: { where: Record<string, unknown>; data: Record<string, unknown> }) => ({ count: 2 }),
    );
    const db = {
      ssoSession: { updateMany, findMany },
      accessToken: { updateMany: tokenUpdateMany },
    } as never;

    const count = await revokeSessionsForUser(db, "user-1", "password_changed");

    expect(count).toBe(3);
    const args = updateMany.mock.calls[0]![0];
    expect(args.where).toEqual({ userId: "user-1", status: "ACTIVE" });
    expect(args.data.revokeReason).toBe("password_changed");

    const tokenArgs = tokenUpdateMany.mock.calls[0]![0];
    expect(tokenArgs.where).toEqual({
      ssoSessionId: { in: ["s-1", "s-2", "s-3"] },
      status: "ACTIVE",
    });
  });
});
