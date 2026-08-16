import type { PrismaClient } from "@sso/db-local";

export interface ActivityEntry {
  applicationId: string;
  event: string;
  correlationId?: string | null;
}

/** Writes one row to the app's activity log (for the frontend Activity Log). */
export async function writeActivity(db: PrismaClient, entry: ActivityEntry): Promise<void> {
  await db.activityLog.create({
    data: {
      applicationId: entry.applicationId,
      event: entry.event,
      correlationId: entry.correlationId ?? null,
    },
  });
}
