import { connect, type ChannelModel, type ConfirmChannel } from "amqplib";
import { createServer, type Server, type ServerResponse } from "node:http";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPrismaClient } from "@sso/db";
import { EventEnvelopeSchema, pingComponent, type ComponentHealth } from "@sso/shared";
import { loadEnv } from "./config.js";
import { assertTopology, publishOutboxEvents, QUEUE } from "./outboxPublisher.js";
import { handleEvent, scheduleRetryOrDeadLetter } from "./consumer.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env"), quiet: true });

const config = loadEnv();
const db = createPrismaClient(config.DATABASE_URL);

const connection: ChannelModel = await connect(config.RABBITMQ_URL);
const channel: ConfirmChannel = await connection.createConfirmChannel();
await assertTopology(channel);

// ── Health probes (B03) — plain node:http, no framework ────────────────────

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.writeHead(statusCode, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

interface ReadinessBody {
  status: "ok" | "degraded";
  checks: { database: ComponentHealth; broker: ComponentHealth };
}

async function readiness(): Promise<ReadinessBody> {
  const [database, broker] = await Promise.all([
    pingComponent(db.$queryRaw`SELECT 1`),
    pingComponent(channel.checkQueue(QUEUE)),
  ]);
  return {
    status: database.ok && broker.ok ? "ok" : "degraded",
    checks: { database, broker },
  };
}

const healthServer: Server = createServer((req, res) => {
  if (req.url === "/health/live") {
    sendJson(res, 200, { status: "ok" });
    return;
  }
  if (req.url === "/health/ready") {
    void readiness().then((body) => sendJson(res, body.status === "ok" ? 200 : 503, body));
    return;
  }
  sendJson(res, 404, { error: { code: "NOT_FOUND", message: "Route not found" } });
});

await new Promise<void>((resolve, reject) => {
  healthServer.once("error", reject);
  healthServer.listen(config.SYNC_WORKER_HEALTH_PORT, "0.0.0.0", () => {
    healthServer.off("error", reject);
    resolve();
  });
});
console.log(`[worker] health probes on :${config.SYNC_WORKER_HEALTH_PORT}`);

// ── Consumer: sso.events -> app /internal/logout ───────────────────────────

let inFlight = 0;
await channel.prefetch(1);
const { consumerTag } = await channel.consume(QUEUE, (msg) => {
  if (!msg) return;
  inFlight++;
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
        try {
          await scheduleRetryOrDeadLetter(db, channel, parsed.data);
          channel.ack(msg);
        } catch (err) {
          console.error("[consumer] retry scheduling failed", err);
          channel.nack(msg, false, true); // redeliver for another attempt
        }
      }
    } catch (err) {
      console.error("[consumer] failed to handle message", err);
      channel.nack(msg, false, true);
    } finally {
      inFlight--;
    }
  })();
});

// ── Publisher: outbox -> RabbitMQ ──────────────────────────────────────────

let shuttingDown = false;
let publisherTimer: ReturnType<typeof setTimeout> | null = null;

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

function schedulePublisherTick(): void {
  publisherTimer = setTimeout(() => {
    void publisherLoop();
  }, config.OUTBOX_POLL_INTERVAL_MS);
}

async function publisherLoop(): Promise<void> {
  await tick();
  if (!shuttingDown) schedulePublisherTick();
}

console.log("[worker] consumer + publisher started");
void publisherLoop();

// ── Graceful shutdown (B04) ────────────────────────────────────────────────

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[worker] shutting down (${signal})`);

  if (publisherTimer) clearTimeout(publisherTimer);

  try {
    await channel.cancel(consumerTag);
  } catch {
    // consumer already gone
  }

  // Drain in-flight handlers before closing; unacked messages are redelivered.
  const deadline = Date.now() + 5_000;
  while (inFlight > 0 && Date.now() < deadline) {
    await sleep(50);
  }
  if (inFlight > 0) {
    console.warn(`[worker] forcing close with ${inFlight} in-flight (will be redelivered)`);
  }

  healthServer.close();

  try {
    await channel.close();
  } catch {
    // already closed
  }
  try {
    await connection.close();
  } catch {
    // already closed
  }
  await db.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
