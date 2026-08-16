import type { Prisma, PrismaClient } from "@sso/db";

export interface AuditEntry {
  eventType: string;
  actorId?: string | null;
  userId?: string | null;
  applicationId?: string | null;
  sessionId?: string | null;
  result: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Writes one row to `audit_logs`. Callers must pass only safe values — never
 * passwords, hashes, or raw tokens.
 */
export async function writeAudit(db: PrismaClient, entry: AuditEntry): Promise<void> {
  await db.auditLog.create({
    data: {
      eventType: entry.eventType,
      actorId: entry.actorId ?? null,
      userId: entry.userId ?? null,
      applicationId: entry.applicationId ?? null,
      sessionId: entry.sessionId ?? null,
      result: entry.result,
      metadata: entry.metadata,
      ipAddress: entry.ipAddress ?? null,
      userAgent: entry.userAgent ?? null,
    },
  });
}
