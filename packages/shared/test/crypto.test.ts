import { describe, expect, it } from "vitest";
import {
  generateTOTP,
  generateTOTPSecret,
  hashPassword,
  randomToken,
  sha256Hex,
  timingSafeEqualHex,
  verifyPassword,
  verifyTOTP,
} from "../src/crypto.js";

describe("randomToken", () => {
  it("returns URL-safe base64url tokens of the requested byte length", () => {
    const token = randomToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Buffer.from(token, "base64url").length).toBe(32);
  });

  it("supports custom lengths", () => {
    expect(Buffer.from(randomToken(48), "base64url").length).toBe(48);
  });

  it("produces unique values", () => {
    expect(randomToken()).not.toBe(randomToken());
  });
});

describe("sha256Hex", () => {
  it("produces the expected digest", () => {
    expect(sha256Hex("hello")).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });
});

describe("timingSafeEqualHex", () => {
  it("accepts equal digests", () => {
    const a = sha256Hex("secret-token");
    expect(timingSafeEqualHex(a, a)).toBe(true);
  });

  it("rejects different digests", () => {
    expect(timingSafeEqualHex(sha256Hex("a"), sha256Hex("b"))).toBe(false);
  });

  it("rejects different lengths", () => {
    expect(timingSafeEqualHex("abcd", "abcdef")).toBe(false);
  });
});

describe("password hashing (argon2id)", () => {
  it("round-trips hash + verify", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).not.toContain("correct horse battery staple");
    expect(await verifyPassword(hash, "correct horse battery staple")).toBe(true);
  });

  it("rejects wrong passwords", async () => {
    const hash = await hashPassword("right");
    expect(await verifyPassword(hash, "wrong")).toBe(false);
  });
});

describe("TOTP (RFC 6238)", () => {
  it("generates base32 secrets", () => {
    const secret = generateTOTPSecret();
    expect(secret).toMatch(/^[A-Z2-7]+$/);
    // default 20 bytes → 32 base32 chars
    expect(secret.length).toBe(32);
  });

  it("generates 6-digit numeric codes", () => {
    const code = generateTOTP("JBSWY3DPEHPK3PXP");
    expect(code).toMatch(/^\d{6}$/);
  });

  it("produces the same code within the same time step", () => {
    const secret = generateTOTPSecret();
    const a = generateTOTP(secret);
    const b = generateTOTP(secret);
    expect(a).toBe(b);
  });

  it("verifyTOTP accepts the current code", () => {
    const secret = generateTOTPSecret();
    const code = generateTOTP(secret);
    expect(verifyTOTP(secret, code)).toBe(true);
  });

  it("verifyTOTP rejects a wrong code", () => {
    const secret = generateTOTPSecret();
    expect(verifyTOTP(secret, "000000")).toBe(false);
  });

  it("supports custom digits and period", () => {
    const secret = generateTOTPSecret();
    const code = generateTOTP(secret, { digits: 8, period: 60 });
    expect(code).toMatch(/^\d{8}$/);
  });
});
