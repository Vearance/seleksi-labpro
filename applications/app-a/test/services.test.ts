import { describe, expect, it, vi } from "vitest";
import { sha256Hex } from "@sso/shared";
import { createOAuthState, consumeOAuthState } from "../src/services/oauth-state-service.js";
import { createLocalSession } from "../src/services/local-session-service.js";
import { writeActivity } from "../src/services/activity-service.js";

const future = new Date(Date.now() + 60_000);
const past = new Date(Date.now() - 60_000);

describe("oauth-state-service", () => {
  it("persists the state with its code verifier", async () => {
    const create = vi.fn(async (args: { data: Record<string, unknown> }) => ({ id: "s1", ...args.data }));
    const db = { oAuthState: { create } } as never;

    const { state } = await createOAuthState(db, { applicationId: "app-a", codeVerifier: "verifier" });

    expect(state).toBeTruthy();
    const data = create.mock.calls[0]![0].data;
    expect(data.state).toBe(state);
    expect(data.codeVerifier).toBe("verifier");
    expect(data.applicationId).toBe("app-a");
    expect((data.expiresAt as Date).getTime()).toBeGreaterThan(Date.now());
  });

  it("returns the verifier for a valid state and consumes it", async () => {
    const updateMany = vi.fn(async (_args: { where: Record<string, unknown>; data: Record<string, unknown> }) => ({ count: 1 }));
    const db = {
      oAuthState: {
        findUnique: vi.fn(async () => ({
          id: "s1",
          applicationId: "app-a",
          codeVerifier: "verifier",
          expiresAt: future,
          consumedAt: null,
        })),
        updateMany,
      },
    } as never;

    const result = await consumeOAuthState(db, "state-1", "app-a");
    expect(result).toEqual({ codeVerifier: "verifier" });

    const args = updateMany.mock.calls[0]![0];
    expect(args.where).toEqual({ id: "s1", consumedAt: null });
    expect(args.data.consumedAt).toBeInstanceOf(Date);
  });

  it("returns null for an expired state", async () => {
    const db = {
      oAuthState: {
        findUnique: vi.fn(async () => ({
          id: "s1",
          applicationId: "app-a",
          codeVerifier: "verifier",
          expiresAt: past,
          consumedAt: null,
        })),
        updateMany: vi.fn(),
      },
    } as never;

    expect(await consumeOAuthState(db, "state-1", "app-a")).toBeNull();
  });

  it("returns null for an already-consumed state (replay)", async () => {
    const db = {
      oAuthState: {
        findUnique: vi.fn(async () => ({
          id: "s1",
          applicationId: "app-a",
          codeVerifier: "verifier",
          expiresAt: future,
          consumedAt: new Date(),
        })),
        updateMany: vi.fn(),
      },
    } as never;

    expect(await consumeOAuthState(db, "state-1", "app-a")).toBeNull();
  });
});

describe("local-session-service", () => {
  it("stores a hash (not the raw token) and binds to app + user + central session", async () => {
    const create = vi.fn(async (args: { data: Record<string, unknown> }) => ({ id: "local-1", ...args.data }));
    const db = { localSession: { create } } as never;

    const { token } = await createLocalSession(db, {
      applicationId: "app-a",
      externalUserId: "user-1",
      centralSessionId: "central-1",
      ttlSeconds: 3600,
    });

    const data = create.mock.calls[0]![0].data;
    expect(data.sessionTokenHash).not.toBe(token);
    expect(data.sessionTokenHash).toBe(sha256Hex(token));
    expect(data).toMatchObject({
      applicationId: "app-a",
      externalUserId: "user-1",
      centralSessionId: "central-1",
      status: "ACTIVE",
    });
  });
});

describe("activity-service", () => {
  it("writes an activity row with correlation id", async () => {
    const create = vi.fn(async (args: { data: Record<string, unknown> }) => ({ id: "a1", ...args.data }));
    const db = { activityLog: { create } } as never;

    await writeActivity(db, { applicationId: "app-a", event: "code_received", correlationId: "corr-1" });

    const data = create.mock.calls[0]![0].data;
    expect(data).toMatchObject({
      applicationId: "app-a",
      event: "code_received",
      correlationId: "corr-1",
    });
  });
});
