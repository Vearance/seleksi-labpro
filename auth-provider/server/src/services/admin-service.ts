import type { PrismaClient } from "@sso/db";
import { verifyPassword, type AdminUser } from "@sso/shared";

/**
 * Authenticates admin credentials. Returns null for any failure.
 */
export async function authenticateAdmin(
  db: PrismaClient,
  email: string,
  password: string,
): Promise<AdminUser | null> {
  const user = await db.user.findUnique({ where: { email } });
  if (!user) return null;

  const passwordValid = await verifyPassword(user.passwordHash, password);
  if (!passwordValid) return null;

  if (user.status !== "ACTIVE" || user.deletedAt !== null) return null;

  const membership = await db.userGroup.findFirst({
    where: { userId: user.id, group: { name: "admin" } },
  });
  if (!membership) return null;

  return { id: user.id, name: user.name, email: user.email };
}

/** True only if the user is active and a member of the "admin" group. */
export async function isAdmin(db: PrismaClient, userId: string): Promise<boolean> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || user.status !== "ACTIVE" || user.deletedAt !== null) return false;

  const membership = await db.userGroup.findFirst({
    where: { userId: user.id, group: { name: "admin" } },
  });
  return membership !== null;
}
