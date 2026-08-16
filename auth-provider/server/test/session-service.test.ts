import { describe, expect, it } from "vitest";
import { isSessionValid } from "../src/services/session-service.js";

const future = new Date(Date.now() + 60_000);
const past = new Date(Date.now() - 60_000);

describe("isSessionValid", () => {
  it("accepts a valid active session", () => {
    expect(isSessionValid({ status: "ACTIVE", expiresAt: future, revokedAt: null }, "ACTIVE")).toBe(true);
  });

  it("rejects an inactive user", () => {
    expect(isSessionValid({ status: "ACTIVE", expiresAt: future, revokedAt: null }, "INACTIVE")).toBe(false);
  });

  it("rejects a revoked session", () => {
    expect(isSessionValid({ status: "ACTIVE", expiresAt: future, revokedAt: new Date() }, "ACTIVE")).toBe(false);
  });

  it("rejects an expired session", () => {
    expect(isSessionValid({ status: "ACTIVE", expiresAt: past, revokedAt: null }, "ACTIVE")).toBe(false);
  });

  it("rejects a non-active session status", () => {
    expect(isSessionValid({ status: "REVOKED", expiresAt: future, revokedAt: null }, "ACTIVE")).toBe(false);
  });
});
