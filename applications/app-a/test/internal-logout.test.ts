import { describe, expect, it, vi } from "vitest";
import { signInternalAuth, verifyInternalAuth } from "@sso/shared";
import { hasProcessedEvent, recordProcessedEvent } from "../src/services/event-dedupe-service.js";

describe("internal auth (HMAC)", () => {
  const secret = "test-secret-at-least-32-chars";
  const timestamp = "1700000000";
  const fields = {
    eventId: "00000000-0000-4000-8000-000000000001",
    eventType: "SessionRevoked",
    userId: "00000000-1000-4000-8000-000000000002",
    centralSessionId: "00000000-2000-4000-8000-000000000003",
    reason: "sso_logout",
  };

  it("verifies a valid signature", () => {
    const sig = signInternalAuth(secret, timestamp, fields);
    expect(verifyInternalAuth(secret, timestamp, fields, sig)).toBe(true);
  });

  it("rejects a wrong secret", () => {
    const sig = signInternalAuth(secret, timestamp, fields);
    expect(verifyInternalAuth("wrong-secret-at-least-32-chars", timestamp, fields, sig)).toBe(false);
  });

  it("rejects tampered fields", () => {
    const sig = signInternalAuth(secret, timestamp, fields);
    expect(
      verifyInternalAuth(secret, timestamp, { ...fields, reason: "password_changed" }, sig),
    ).toBe(false);
  });

  it("rejects a wrong timestamp", () => {
    const sig = signInternalAuth(secret, timestamp, fields);
    expect(verifyInternalAuth(secret, "1700000001", fields, sig)).toBe(false);
  });
});

describe("event-dedupe-service", () => {
  it("hasProcessedEvent returns true when the row exists", async () => {
    const db = { processedEvent: { findUnique: vi.fn(async () => ({ eventId: "e1" })) } } as never;
    expect(await hasProcessedEvent(db, "app-a", "e1")).toBe(true);
  });

  it("hasProcessedEvent returns false when absent", async () => {
    const db = { processedEvent: { findUnique: vi.fn(async () => null) } } as never;
    expect(await hasProcessedEvent(db, "app-a", "e1")).toBe(false);
  });

  it("recordProcessedEvent writes the row", async () => {
    const create = vi.fn(async (args: { data: Record<string, unknown> }) => ({ ...args.data }));
    const db = { processedEvent: { create } } as never;

    await recordProcessedEvent(db, "app-a", "e1", "SessionRevoked", "local_session_revoked");

    expect(create.mock.calls[0]![0].data).toEqual({
      applicationId: "app-a",
      eventId: "e1",
      eventType: "SessionRevoked",
      result: "local_session_revoked",
    });
  });
});
