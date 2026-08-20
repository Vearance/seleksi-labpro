import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { hash as argon2idHash, verify as argon2idVerify } from "@node-rs/argon2";

/**
 * Generates a URL-safe random token (32 bytes by default -> 43 base64url chars)
 */
export function randomToken(byteLength = 32): string {
  return randomBytes(byteLength).toString("base64url");
}

/** SHA-256 hex digest of a string or buffer. Used to hash tokens at rest. */
export function sha256Hex(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

/** SHA-256 digest base64url-encoded (used by PKCE `S256`). */
export function sha256Base64Url(input: string): string {
  return createHash("sha256").update(input).digest("base64url");
}

/**
 * Verifies a PKCE `code_verifier` against the stored `code_challenge`.
 * - `S256`: challenge === base64url(sha256(verifier))
 * - `plain`: challenge === verifier
 * Comparison is constant-time so a partial match does not leak content.
 */
export function verifyPkce(challenge: string, verifier: string, method: string): boolean {
  const expected = method === "S256" ? sha256Base64Url(verifier) : verifier;
  const a = Buffer.from(challenge);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// Internal service-to-service auth (HMAC-SHA256), used by the sync worker -> relying apps on `/internal/logout`. 

export interface InternalAuthFields {
  eventId: string;
  eventType: string;
  userId: string;
  centralSessionId?: string | null;
  reason?: string | null;
}

/** Stable canonical string signed by both the worker and the relying app. */
export function buildInternalAuthCanonical(fields: InternalAuthFields): string {
  return [
    fields.eventId,
    fields.eventType,
    fields.userId,
    fields.centralSessionId ?? "",
    fields.reason ?? "",
  ].join(":");
}

/** Signs an internal request: HMAC-SHA256 over `<timestamp>.<canonical>`. */
export function signInternalAuth(
  secret: string,
  timestamp: string,
  fields: InternalAuthFields,
): string {
  const canonical = buildInternalAuthCanonical(fields);
  return createHmac("sha256", secret).update(`${timestamp}.${canonical}`).digest("hex");
}

/** Constant-time verification of an internal request signature. */
export function verifyInternalAuth(
  secret: string,
  timestamp: string,
  fields: InternalAuthFields,
  signature: string,
): boolean {
  const expected = signInternalAuth(secret, timestamp, fields);
  return timingSafeEqualHex(expected, signature);
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

// Argon2id parameters, OWASP minimum
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
