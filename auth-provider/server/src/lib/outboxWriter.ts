import { randomUUID } from "node:crypto";
import type { Prisma } from "@sso/db";
import type { EventEnvelope, EventType } from "@sso/shared";

export interface OutboxEventInput {
  eventType: EventType;
  userId: string;
  centralSessionId?: string | null;
  applicationId?: string | null;
  reason?: string;
  metadata?: Record<string, unknown>;
}

/** Builds a spec-shaped event envelope. `eventId` is generated fresh. */
export function buildEventEnvelope(input: OutboxEventInput): EventEnvelope {
  return {
    eventId: randomUUID(),
    eventType: input.eventType,
    userId: input.userId,
    centralSessionId: input.centralSessionId ?? null,
    applicationId: input.applicationId ?? null,
    reason: input.reason,
    occurredAt: new Date().toISOString(),
    metadata: input.metadata ?? {},
  };
}

/**
 * Writes an outbox event row (status PENDING) inside the current transaction.
 * Call this in the SAME `$transaction` as the session change so the event is
 * never lost when the broker is down (transactional outbox).
 */
export async function writeOutboxEvent(
  tx: Prisma.TransactionClient,
  envelope: EventEnvelope,
): Promise<void> {
  await tx.event.create({
    data: {
      id: envelope.eventId,
      eventType: envelope.eventType,
      userId: envelope.userId,
      centralSessionId: envelope.centralSessionId,
      applicationId: envelope.applicationId,
      payload: envelope as unknown as Prisma.InputJsonValue,
      status: "PENDING",
    },
  });
}
