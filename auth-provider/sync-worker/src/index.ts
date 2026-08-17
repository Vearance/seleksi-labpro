import { connect } from "amqplib";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPrismaClient } from "@sso/db";
import { loadEnv } from "./config.js";
import { assertTopology, publishOutboxEvents } from "./outboxPublisher.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env"), quiet: true });

const config = loadEnv();
const db = createPrismaClient(config.DATABASE_URL);

const connection = await connect(config.RABBITMQ_URL);
const channel = await connection.createConfirmChannel();
await assertTopology(channel);

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

async function loop(): Promise<void> {
  await tick();
  setTimeout(() => void loop(), config.OUTBOX_POLL_INTERVAL_MS);
}

console.log("[publisher] started");
void loop();

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[publisher] shutting down (${signal})`);
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
