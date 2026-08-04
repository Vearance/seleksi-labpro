import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { hash as argon2idHash, verify as argon2idVerify } from "@node-rs/argon2";

/**
 * Generates a URL-safe random token (32 bytes by default → 43 base64url chars)
 */
export function randomToken(byteLength = 32): string {
  return randomBytes(byteLength).toString("base64url");
}

/** SHA-256 hex digest of a string or buffer. Used to hash tokens at rest. */
export function sha256Hex(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Constant-time comparison of two hex-encoded digests. Returns false early
 * when lengths differ (public information) without leaking content.
 */
export function timingSafeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

// Argon2id parameters.
const ARGON2_OPTIONS = {
  algorithm: 2, // Argon2id
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

/** Hashes a password with Argon2id. */
export async function hashPassword(password: string): Promise<string> {
  return argon2idHash(password, ARGON2_OPTIONS);
}

/** Verifies a password against an Argon2id hash (constant-time). */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2idVerify(hash, password);
}
