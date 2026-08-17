import type { ConfirmChannel } from "amqplib";
import type { PrismaClient } from "@sso/db";
import type { EventEnvelope } from "@sso/shared";
import { notifyApp, type NotifyResult } from "./notifier.js";
import { DLQ_ROUTING_KEY, DLX, RETRY_QUEUE } from "./outboxPublisher.js";
import { backoffMs, MAX_ATTEMPTS } from "./retry.js";

export type NotifyFn = (
  url: string,
  secret: string,
  envelope: EventEnvelope,
) => Promise<NotifyResult>;

/**
 * Handles one event: resolves the target applications,
 * tracks each delivery separately in `event_deliveries`,
 * and notifies each app's `/internal/logout`. Apps that already succeeded are
 * skipped on redelivery (idempotent). Returns true when all deliveries succeeded.
 */
export async function handleEvent(
  db: PrismaClient,
  envelope: EventEnvelope,
  secret: string,
  notify: NotifyFn = notifyApp,
): Promise<boolean> {
  const apps = await db.application.findMany({
    where: envelope.applicationId
      ? { id: envelope.applicationId, status: "ACTIVE" }
      : { status: "ACTIVE" }, // if appId is null, deliver to all active apps
  });

  let allSucceeded = true;

  for (const app of apps) {
    const key = { eventId: envelope.eventId, applicationId: app.id };
    const existing = await db.eventDelivery.findUnique({
      where: { eventId_applicationId: key },
    });

    if (existing?.status === "SUCCEEDED") {
      continue; // already delivered, safe to skip on redelivery
    }

    if (existing) {
      await db.eventDelivery.update({
        where: { eventId_applicationId: key },
        data: {
          status: "PROCESSING",
          attemptCount: { increment: 1 },
          lastAttemptAt: new Date(),
        },
      });
    } else {
      await db.eventDelivery.create({
        data: {
          eventId: envelope.eventId,
          applicationId: app.id,
          status: "PROCESSING",
          attemptCount: 1,
          lastAttemptAt: new Date(),
        },
      });
    }

    const result = await notify(app.logoutNotificationUrl, secret, envelope);

    if (result.ok) {
      await db.eventDelivery.update({
        where: { eventId_applicationId: key },
        data: { status: "SUCCEEDED", processedAt: new Date() },
      });
    } else {
      allSucceeded = false;
      await db.eventDelivery.update({
        where: { eventId_applicationId: key },
        data: {
          status: "RETRYING",
          lastError: result.error ?? "delivery failed",
        },
      });
    }
  }

  return allSucceeded;
}

/**
 * After a failed attempt: either schedule a retry (publish to the TTL retry
 * queue with backoff) or dead-letter the event when max attempts are reached.
 * Waits for broker confirms before returning so the caller can safely ack.
 */
export async function scheduleRetryOrDeadLetter(
  db: PrismaClient,
  channel: ConfirmChannel,
  envelope: EventEnvelope,
): Promise<void> {
  const deliveries = await db.eventDelivery.findMany({
    where: { eventId: envelope.eventId, status: { not: "SUCCEEDED" } },
  });

  const maxAttempt = deliveries.reduce((max, d) => Math.max(max, d.attemptCount), 0);
  const content = Buffer.from(JSON.stringify(envelope));

  if (maxAttempt >= MAX_ATTEMPTS) {
    channel.publish(DLX, DLQ_ROUTING_KEY, content, { persistent: true });
    await channel.waitForConfirms();

    await db.eventDelivery.updateMany({
      where: { eventId: envelope.eventId, status: { not: "SUCCEEDED" } },
      data: { status: "FAILED" },
    });
  } else {
    const delay = backoffMs(maxAttempt);
    channel.sendToQueue(RETRY_QUEUE, content, { persistent: true, expiration: String(delay) });
    await channel.waitForConfirms();

    await db.eventDelivery.updateMany({
      where: { eventId: envelope.eventId, status: { not: "SUCCEEDED" } },
      data: { nextRetryAt: new Date(Date.now() + delay) },
    });
  }
}
