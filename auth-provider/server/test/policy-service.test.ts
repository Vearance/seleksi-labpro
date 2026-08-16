import { describe, expect, it, vi } from "vitest";
import { addPolicy, evaluateAccess } from "../src/services/policy-service.js";

const activeUser = { status: "ACTIVE" as const, groups: [{ groupId: "g1" }] };
const activeApp = {
  status: "ACTIVE" as const,
  redirectUris: ["http://localhost/callback"],
  policies: [{ groupId: "g1", access: "ALLOW" as const }],
};

describe("evaluateAccess", () => {
  it("allows a valid request", () => {
    expect(evaluateAccess(activeUser, activeApp, "http://localhost/callback")).toEqual({
      allowed: true,
      reason: "ALLOWED",
    });
  });

  it("denies an inactive application", () => {
    const app = { ...activeApp, status: "INACTIVE" as const };
    expect(evaluateAccess(activeUser, app, "http://localhost/callback")).toEqual({
      allowed: false,
      reason: "APPLICATION_INACTIVE",
    });
  });

  it("denies an unregistered redirect URI (exact match)", () => {
    expect(evaluateAccess(activeUser, activeApp, "http://evil.example/callback")).toEqual({
      allowed: false,
      reason: "REDIRECT_URI_NOT_REGISTERED",
    });
  });

  it("denies an inactive user", () => {
    const user = { ...activeUser, status: "INACTIVE" as const };
    expect(evaluateAccess(user, activeApp, "http://localhost/callback")).toEqual({
      allowed: false,
      reason: "USER_INACTIVE",
    });
  });

  it("denies when no ALLOW policy links the user's group to the app", () => {
    const app = { ...activeApp, policies: [] };
    expect(evaluateAccess(activeUser, app, "http://localhost/callback")).toEqual({
      allowed: false,
      reason: "NO_ALLOW_POLICY",
    });
  });
});

function mockDb(overrides: Record<string, unknown> = {}) {
  return {
    application: { findUnique: vi.fn(async () => ({ id: "a1" })) },
    group: { findUnique: vi.fn(async () => ({ id: "g1", name: "employees" })) },
    applicationGroupPolicy: {
      findUnique: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: "p1",
        applicationId: data.applicationId,
        groupId: data.groupId,
        access: data.access ?? "ALLOW",
        createdAt: new Date(),
        group: { name: "employees" },
      })),
      delete: vi.fn(),
    },
    ...overrides,
  } as never;
}

describe("addPolicy", () => {
  it("creates an ALLOW policy", async () => {
    const db = mockDb();
    const create = (db as { applicationGroupPolicy: { create: ReturnType<typeof vi.fn> } })
      .applicationGroupPolicy.create;

    const policy = await addPolicy(db, { applicationId: "a1", groupId: "g1" });

    const call = create.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(call.data).toEqual({ applicationId: "a1", groupId: "g1", access: "ALLOW" });
    expect(policy.groupName).toBe("employees");
  });

  it("rejects a duplicate policy", async () => {
    const db = mockDb({
      applicationGroupPolicy: {
        findUnique: vi.fn(async () => ({ id: "existing" })),
      },
    });

    await expect(addPolicy(db, { applicationId: "a1", groupId: "g1" })).rejects.toMatchObject({
      code: "POLICY_EXISTS",
    });
  });
});
