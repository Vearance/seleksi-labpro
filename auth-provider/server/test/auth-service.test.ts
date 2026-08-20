import { describe, expect, it, vi } from "vitest";
import { hashPassword } from "@sso/shared";
import { verifyCredentials } from "../src/services/auth-service.js";

function mockUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "u1",
    name: "Aloi",
    email: "aloi@example.com",
    passwordHash: "ignored",
    status: "ACTIVE",
    ...overrides,
  };
}

describe("verifyCredentials", () => {
  it("returns ok for valid credentials", async () => {
    const passwordHash = await hashPassword("secret123");
    const db = { user: { findUnique: vi.fn(async () => mockUser({ passwordHash })) } } as never;

    const result = await verifyCredentials(db, "aloi@example.com", "secret123");
    expect(result).toMatchObject({ ok: true });
  });

  it("returns INVALID_PASSWORD for a wrong password", async () => {
    const passwordHash = await hashPassword("secret123");
    const db = { user: { findUnique: vi.fn(async () => mockUser({ passwordHash })) } } as never;

    const result = await verifyCredentials(db, "aloi@example.com", "wrong");
    expect(result).toMatchObject({ ok: false, reason: "INVALID_PASSWORD" });
  });

  it("returns NOT_FOUND for a missing email", async () => {
    const db = { user: { findUnique: vi.fn(async () => null) } } as never;

    const result = await verifyCredentials(db, "nobody@example.com", "secret123");
    expect(result).toMatchObject({ ok: false, reason: "NOT_FOUND" });
  });

  it("returns INACTIVE for an inactive user with a valid password", async () => {
    const passwordHash = await hashPassword("secret123");
    const db = {
      user: { findUnique: vi.fn(async () => mockUser({ passwordHash, status: "INACTIVE" })) },
    } as never;

    const result = await verifyCredentials(db, "aloi@example.com", "secret123");
    expect(result).toMatchObject({ ok: false, reason: "INACTIVE" });
  });
});
