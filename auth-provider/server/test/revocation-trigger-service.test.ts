import { describe, expect, it, vi } from "vitest";
import {
  handlePasswordChange,
  handleUserDeactivation,
  handlePolicyRemoval,
} from "../src/services/revocation-trigger-service.js";

function buildDb(opts?: {
  members?: { userId: string }[];
  stillAllowed?: (userId: string) => boolean;
}) {
  const updateMany = vi.fn(async (_args: { where: Record<string, unknown>; data: Record<string, unknown> }) => ({ count: 3 }));
  const findMany = vi.fn(async () => [{ id: "s-1" }, { id: "s-2" }, { id: "s-3" }]);
  const tokenUpdateMany = vi.fn(
    async (_args: { where: Record<string, unknown>; data: Record<string, unknown> }) => ({ count: 2 }),
  );
  const eventCreate = vi.fn(async (args: { data: Record<string, unknown> }) => args.data);
  const auditCreate = vi.fn(async (args: { data: Record<string, unknown> }) => args.data);
  const findFirst = vi.fn(
    async (args: { where: { group: { users: { some: { userId: string } } } } }) => {
      const userId = args.where.group.users.some.userId;
      if (opts?.stillAllowed) return opts.stillAllowed(userId) ? { id: "policy" } : null;
      return null;
    },
  );

  const tx = {
    ssoSession: { updateMany, findMany },
    accessToken: { updateMany: tokenUpdateMany },
    event: { create: eventCreate },
    applicationGroupPolicy: { findFirst },
  };
  const db = {
    ssoSession: { updateMany, findMany },
    accessToken: { updateMany: tokenUpdateMany },
    event: { create: eventCreate },
    auditLog: { create: auditCreate },
    userGroup: { findMany: vi.fn(async () => opts?.members ?? []) },
    applicationGroupPolicy: { findFirst },
    $transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
  } as never;

  return { db, updateMany, tokenUpdateMany, eventCreate, auditCreate };
}

describe("handlePasswordChange", () => {
  it("revokes every session (and its tokens) and emits PasswordChanged", async () => {
    const { db, updateMany, tokenUpdateMany, eventCreate, auditCreate } = buildDb();

    await handlePasswordChange(db, "user-1");

    expect(updateMany).toHaveBeenCalledTimes(1);
    const args = updateMany.mock.calls[0]![0];
    expect(args.where).toEqual({ userId: "user-1", status: "ACTIVE" });
    expect(args.data.revokeReason).toBe("password_changed");

    // Access tokens linked to the revoked sessions are revoked in the same tx.
    expect(tokenUpdateMany).toHaveBeenCalledTimes(1);
    expect(tokenUpdateMany.mock.calls[0]![0].where).toEqual({
      ssoSessionId: { in: ["s-1", "s-2", "s-3"] },
      status: "ACTIVE",
    });

    const eventData = eventCreate.mock.calls[0]![0].data as Record<string, unknown>;
    expect(eventData.eventType).toBe("PasswordChanged");
    expect(eventData.userId).toBe("user-1");
    expect(eventData.centralSessionId).toBeNull();

    expect(auditCreate.mock.calls[0]![0].data).toMatchObject({
      eventType: "password_changed",
      result: "success",
    });
  });
});

describe("handleUserDeactivation", () => {
  it("revokes every session (and its tokens) and emits SessionRevoked", async () => {
    const { db, tokenUpdateMany, eventCreate, auditCreate } = buildDb();

    await handleUserDeactivation(db, "user-1");

    expect(tokenUpdateMany).toHaveBeenCalledTimes(1);

    const eventData = eventCreate.mock.calls[0]![0].data as Record<string, unknown>;
    expect(eventData.eventType).toBe("SessionRevoked");
    expect(eventData.userId).toBe("user-1");
    expect(eventData.centralSessionId).toBeNull();

    expect(auditCreate.mock.calls[0]![0].data).toMatchObject({
      eventType: "user_deactivated",
      result: "success",
    });
  });
});

describe("handlePolicyRemoval", () => {
  it("emits AccessPolicyChanged only for users who lost access, targeted to the app", async () => {
    const { db, eventCreate, auditCreate } = buildDb({
      members: [{ userId: "user-1" }, { userId: "user-2" }],
      stillAllowed: (userId) => userId === "user-2", // user-2 keeps access via another group
    });

    await handlePolicyRemoval(db, "app-id", "group-id");

    expect(eventCreate).toHaveBeenCalledTimes(1);
    const eventData = eventCreate.mock.calls[0]![0].data as Record<string, unknown>;
    expect(eventData.eventType).toBe("AccessPolicyChanged");
    expect(eventData.userId).toBe("user-1");
    expect(eventData.applicationId).toBe("app-id");

    expect(auditCreate.mock.calls[0]![0].data).toMatchObject({
      eventType: "policy_changed",
      result: "success",
    });
  });

  it("emits nothing when every user keeps access", async () => {
    const { db, eventCreate, auditCreate } = buildDb({
      members: [{ userId: "user-1" }],
      stillAllowed: () => true,
    });

    await handlePolicyRemoval(db, "app-id", "group-id");

    expect(eventCreate).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });
});
