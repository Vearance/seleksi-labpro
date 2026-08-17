import { connect } from "amqplib";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPrismaClient } from "@sso/db";
import { EventEnvelopeSchema } from "@sso/shared";
import { loadEnv } from "./config.js";
import { assertTopology, publishOutboxEvents, QUEUE } from "./outboxPublisher.js";
import { handleEvent } from "./consumer.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env"), quiet: true });

const config = loadEnv();
const db = createPrismaClient(config.DATABASE_URL);

const connection = await connect(config.RABBITMQ_URL);
const channel = await connection.createConfirmChannel();
await assertTopology(channel);

// Consumer: sso.events -> app /internal/logout 
await channel.prefetch(1);
await channel.consume(QUEUE, (msg) => {
  if (!msg) return;
  void (async () => {
    try {
      const parsed = EventEnvelopeSchema.safeParse(JSON.parse(msg.content.toString()));
      if (!parsed.success) {
        console.error("[consumer] invalid envelope, dropping", parsed.error.issues);
        channel.ack(msg);
        return;
      }

      const ok = await handleEvent(db, parsed.data, config.INTERNAL_HMAC_SECRET);
      console.log(`[consumer] event ${parsed.data.eventId} handled (allSucceeded=${ok})`);
      if (ok) {
        channel.ack(msg);
      } else {
        // Transient failure: requeue so the message is redelivered.
        channel.nack(msg, false, true);
      }
    } catch (err) {
      console.error("[consumer] failed to handle message", err);
      channel.nack(msg, false, true);
    }
  })();
});

// Publisher: outbox -> RabbitMQ
async function tick(): Promise<void> {
  try {
    const count = await publishOutboxEvents(db, channel);
    if (count > 0) {
      console.log(`[publisher] published ${count} event(s)`);
    }
  } catch (err) {
    console.error("[publisher] tick failed", err);
  }
}

async function publisherLoop(): Promise<void> {
  await tick();
  setTimeout(() => void publisherLoop(), config.OUTBOX_POLL_INTERVAL_MS);
}

console.log("[worker] consumer + publisher started");
void publisherLoop();

// Graceful shutdown 
let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[worker] shutting down (${signal})`);
  try {
    await channel.close();
    await connection.close();
    await db.$disconnect();
  } finally {
    process.exit(0);
  }
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
