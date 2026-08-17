import type { ConfirmChannel } from "amqplib";
import type { PrismaClient } from "@sso/db";

export const EXCHANGE = "sso.events";
export const QUEUE = "sso.events";
export const ROUTING_KEY = "sso.events";

/** Declares the durable exchange + queue and binds them. */
export async function assertTopology(channel: ConfirmChannel): Promise<void> {
  await channel.assertExchange(EXCHANGE, "direct", { durable: true });
  await channel.assertQueue(QUEUE, { durable: true });
  await channel.bindQueue(QUEUE, EXCHANGE, ROUTING_KEY);
}

/**
 * Publishes all unpublished outbox events to RabbitMQ. Marks `published_at`
 * only after the broker confirms the publish (publisher confirms).
 */
export async function publishOutboxEvents(db: PrismaClient, channel: ConfirmChannel): Promise<number> {
  const events = await db.event.findMany({
    where: { publishedAt: null },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  for (const event of events) {
    channel.publish(EXCHANGE, ROUTING_KEY, Buffer.from(JSON.stringify(event.payload)), {
      persistent: true,
    });
    await channel.waitForConfirms();

    await db.event.update({
      where: { id: event.id },
      data: { status: "PUBLISHED", publishedAt: new Date() },
    });
  }

  return events.length;
}
