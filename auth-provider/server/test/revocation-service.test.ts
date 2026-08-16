import { describe, expect, it, vi } from "vitest";
import { revokeSession, revokeSessionsForUser } from "../src/services/revocation-service.js";

describe("revokeSession", () => {
  it("marks the session REVOKED with a reason and timestamp", async () => {
    const updateMany = vi.fn(async (_args: { where: Record<string, unknown>; data: Record<string, unknown> }) => ({ count: 1 }));
    const db = { ssoSession: { updateMany } } as never;

    const result = await revokeSession(db, "session-1", "sso_logout");

    expect(result).toBe(true);
    const args = updateMany.mock.calls[0]![0];
    expect(args.where).toEqual({ id: "session-1", status: "ACTIVE" });
    expect(args.data.status).toBe("REVOKED");
    expect(args.data.revokeReason).toBe("sso_logout");
    expect(args.data.revokedAt).toBeInstanceOf(Date);
  });

  it("returns false when no active session was revoked", async () => {
    const db = { ssoSession: { updateMany: vi.fn(async () => ({ count: 0 })) } } as never;
    expect(await revokeSession(db, "session-1", "sso_logout")).toBe(false);
  });
});

describe("revokeSessionsForUser", () => {
  it("revokes every active session for the user and returns the count", async () => {
    const updateMany = vi.fn(async (_args: { where: Record<string, unknown>; data: Record<string, unknown> }) => ({ count: 3 }));
    const db = { ssoSession: { updateMany } } as never;

    const count = await revokeSessionsForUser(db, "user-1", "password_changed");

    expect(count).toBe(3);
    const args = updateMany.mock.calls[0]![0];
    expect(args.where).toEqual({ userId: "user-1", status: "ACTIVE" });
    expect(args.data.revokeReason).toBe("password_changed");
  });
});
