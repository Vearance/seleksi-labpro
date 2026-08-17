import type { PrismaClient } from "@sso/db";
import { buildEventEnvelope, writeOutboxEvent } from "../lib/outboxWriter.js";
import { writeAudit } from "./audit-service.js";
import { revokeSessionsForUser } from "./revocation-service.js";

/**
 * Password change: revoke EVERY central session of the user + emit
 * `PasswordChanged` (apps revoke all local sessions for the user).
 */
export async function handlePasswordChange(db: PrismaClient, userId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    await revokeSessionsForUser(tx, userId, "password_changed");
    await writeOutboxEvent(
      tx,
      buildEventEnvelope({
        eventType: "PasswordChanged",
        userId,
        centralSessionId: null,
        reason: "password_changed",
      }),
    );
  });
  await writeAudit(db, { eventType: "password_changed", userId, result: "success" });
}

/**
 * User deactivation: revoke every central session + emit `SessionRevoked`.
 */
export async function handleUserDeactivation(db: PrismaClient, userId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    await revokeSessionsForUser(tx, userId, "user_deactivated");
    await writeOutboxEvent(
      tx,
      buildEventEnvelope({
        eventType: "SessionRevoked",
        userId,
        centralSessionId: null,
        reason: "user_deactivated",
      }),
    );
  });
  await writeAudit(db, { eventType: "user_deactivated", userId, result: "success" });
}

/**
 * Policy removal: for every user in the removed group who no longer has any
 * ALLOW policy for the application, emit `AccessPolicyChanged` targeted to
 * that application only.
 */
export async function handlePolicyRemoval(
  db: PrismaClient,
  applicationId: string,
  groupId: string,
): Promise<void> {
  const memberships = await db.userGroup.findMany({
    where: { groupId },
    select: { userId: true },
  });

  let emitted = 0;
  await db.$transaction(async (tx) => {
    for (const membership of memberships) {
      const stillAllowed = await tx.applicationGroupPolicy.findFirst({
        where: {
          applicationId,
          access: "ALLOW",
          group: { users: { some: { userId: membership.userId } } },
        },
      });
      if (!stillAllowed) {
        await writeOutboxEvent(
          tx,
          buildEventEnvelope({
            eventType: "AccessPolicyChanged",
            userId: membership.userId,
            applicationId,
            reason: "policy_changed",
          }),
        );
        emitted += 1;
      }
    }
  });

  if (emitted > 0) {
    await writeAudit(db, {
      eventType: "policy_changed",
      applicationId,
      result: "success",
      metadata: { affectedUsers: emitted },
    });
  }
}
