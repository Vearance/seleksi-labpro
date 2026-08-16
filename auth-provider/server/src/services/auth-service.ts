import type { PrismaClient } from "@sso/db";
import { verifyPassword, type UserStatus } from "@sso/shared";

export interface UserForAuth {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
}

export type CredentialResult =
  | { ok: true; user: UserForAuth }
  | { ok: false; reason: "NOT_FOUND" | "INVALID_PASSWORD" | "INACTIVE"; user?: UserForAuth };

/**
 * Verifies a user's credentials. Returns a discriminated result so the caller
 * can write a precise audit row while still sending a generic error to the
 * client (no user enumeration).
 */
export async function verifyCredentials(
  db: PrismaClient,
  email: string,
  password: string,
): Promise<CredentialResult> {
  const user = await db.user.findUnique({ where: { email } });
  if (!user) return { ok: false, reason: "NOT_FOUND" };

  const publicUser: UserForAuth = {
    id: user.id,
    name: user.name,
    email: user.email,
    status: user.status as UserStatus,
  };

  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) return { ok: false, reason: "INVALID_PASSWORD", user: publicUser };

  if (user.status !== "ACTIVE") return { ok: false, reason: "INACTIVE", user: publicUser };

  return { ok: true, user: publicUser };
}
