import type { PrismaClient } from "@sso/db-local";

// Used by sync-worker

/** True when this app has already processed the given event_id. */
export async function hasProcessedEvent(
  db: PrismaClient,
  applicationId: string,
  eventId: string,
): Promise<boolean> {
  const row = await db.processedEvent.findUnique({
    where: { applicationId_eventId: { applicationId, eventId } },
  });
  return row !== null;
}

/** Records an event as processed (used for idempotent redelivery). */
export async function recordProcessedEvent(
  db: PrismaClient,
  applicationId: string,
  eventId: string,
  eventType: string,
  result: string,
): Promise<void> {
  await db.processedEvent.create({
    data: { applicationId, eventId, eventType, result },
  });
}
