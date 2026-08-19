import fp from "fastify-plugin";
import { connect, type Channel, type Connection } from "amqplib";
import { Counter, Gauge, Histogram, Registry } from "prom-client";
import type { FastifyInstance } from "fastify";

export const MAIN_QUEUE = "sso.events";
export const RETRY_QUEUE = "sso.events.retry";
export const DLQ = "sso.events.dlq";
const QUEUES = [MAIN_QUEUE, RETRY_QUEUE, DLQ] as const;

const REFRESH_INTERVAL_MS = 5_000;
const RECONNECT_DELAY_MS = 5_000;
const MAX_LATENCY_SAMPLES = 1_000;

export interface MetricsSnapshot {
  timestamp: number;
  uptimeSeconds: number;
  http: {
    requestsTotal: number;
    /** Requests answered with status >= 400. */
    errorsTotal: number;
    avgMs: number | null;
    p50Ms: number | null;
    p95Ms: number | null;
  };
  queues: Record<string, number>;
  outboxPending: number;
}

/** Sliding window of request durations (ms) for live percentile estimates. */
class LatencyWindow {
  private samples: number[] = [];
  private count = 0;
  private sum = 0;

  push(ms: number): void {
    this.count += 1;
    this.sum += ms;
    this.samples.push(ms);
    if (this.samples.length > MAX_LATENCY_SAMPLES) this.samples.shift();
  }

  percentile(p: number): number | null {
    if (this.samples.length === 0) return null;
    const sorted = [...this.samples].sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
    return sorted[index] ?? null;
  }

  average(): number | null {
    return this.count === 0 ? null : this.sum / this.count;
  }
}

declare module "fastify" {
  interface FastifyInstance {
    metrics: {
      registry: Registry;
      snapshot: () => Promise<MetricsSnapshot>;
      /** Round-trip to the broker; rejects when not connected (readiness). */
      pingBroker: () => Promise<unknown>;
    };
  }
}

/**
 * Observability: Prometheus registry + HTTP RED instrumentation,
 * broker queue-depth gauges (main / retry / DLQ), outbox depth, and a JSON
 * snapshot for the control-panel dashboard. The broker connection is
 * best-effort and keeps retrying in the background — it must never take the
 * auth-server down (outbox writes are DB-only).
 */
export default fp(
  async (fastify: FastifyInstance) => {
    const isTest = fastify.config.NODE_ENV === "test";

    const registry = new Registry();
    registry.setDefaultLabels({ service: "auth-server" });

    const httpRequests = new Counter({
      name: "http_requests_total",
      help: "HTTP requests handled by the auth server",
      labelNames: ["method", "route", "status_code"],
      registers: [registry],
    });

    const httpDuration = new Histogram({
      name: "http_request_duration_seconds",
      help: "HTTP request duration in seconds",
      labelNames: ["method", "route"],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [registry],
    });

    const queueMessages = new Gauge({
      name: "rabbitmq_queue_messages",
      help: "Messages waiting in a queue",
      labelNames: ["queue"],
      registers: [registry],
    });

    const outboxPendingGauge = new Gauge({
      name: "outbox_pending_events",
      help: "Outbox events not yet published to the broker",
      registers: [registry],
    });

    // ── HTTP RED instrumentation ───────────────────────────────────────

    type StopTimer = ReturnType<Histogram["startTimer"]>;
    const timers = new WeakMap<object, StopTimer>();
    const latency = new LatencyWindow();
    let requestCount = 0;
    let errorCount = 0;

    fastify.addHook("onRequest", async (request) => {
      timers.set(request.raw, httpDuration.startTimer());
    });

    fastify.addHook("onResponse", async (request, reply) => {
      const labels = { method: request.method, route: request.routeOptions.url ?? "unknown" };
      timers.get(request.raw)?.({ ...labels });
      httpRequests.inc({ ...labels, status_code: String(reply.statusCode) });

      latency.push(reply.elapsedTime);
      requestCount += 1;
      if (reply.statusCode >= 400) errorCount += 1;
    });

    // Best-effort broker connection (metrics + readiness)

    let channel: Channel | null = null;
    let connection: Connection | null = null;
    let stopped = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    async function connectBroker(): Promise<void> {
      if (stopped || isTest) return;
      try {
        const conn = await connect(fastify.config.RABBITMQ_URL);
        const ch = await conn.createChannel();
        const onDown = () => {
          if (stopped) return;
          if (channel === ch) channel = null;
          scheduleReconnect();
        };
        ch.on("close", onDown);
        conn.on("error", () => undefined);
        conn.on("close", onDown);
        connection = conn;
        channel = ch;
        fastify.log.info("connected to message broker (metrics/readiness)");
      } catch (err) {
        fastify.log.warn({ err }, "message broker connect failed; retrying in background");
        scheduleReconnect();
      }
    }

    function scheduleReconnect(): void {
      if (stopped || isTest || reconnectTimer) return;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        void connectBroker();
      }, RECONNECT_DELAY_MS);
    }

    // Gauges refreshed periodically

    const queueDepths: Record<string, number> = {};
    for (const q of QUEUES) queueDepths[q] = 0;
    let outboxPending = 0;

    async function refresh(): Promise<void> {
      try {
        outboxPending = await fastify.db.event.count({ where: { publishedAt: null } });
      } catch {
        // DB unavailable — keep the previous value
      }
      outboxPendingGauge.set(outboxPending);

      for (const q of QUEUES) {
        let depth = 0;
        if (channel) {
          try {
            const info = await channel.checkQueue(q);
            depth = info.messageCount;
          } catch {
            depth = 0;
          }
        }
        queueDepths[q] = depth;
        queueMessages.set({ queue: q }, depth);
      }
    }

    let refreshTimer: ReturnType<typeof setInterval> | null = null;
    if (!isTest) {
      refreshTimer = setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
      void refresh();
      void connectBroker();
    }

    async function pingBroker(): Promise<unknown> {
      if (!channel) throw new Error("broker not connected");
      return channel.checkQueue(MAIN_QUEUE);
    }

    async function snapshot(): Promise<MetricsSnapshot> {
      return {
        timestamp: Date.now(),
        uptimeSeconds: Math.floor(process.uptime()),
        http: {
          requestsTotal: requestCount,
          errorsTotal: errorCount,
          avgMs: latency.average(),
          p50Ms: latency.percentile(50),
          p95Ms: latency.percentile(95),
        },
        queues: { ...queueDepths },
        outboxPending,
      };
    }

    fastify.decorate("metrics", { registry, snapshot, pingBroker });

    fastify.addHook("onClose", async () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (refreshTimer) clearInterval(refreshTimer);
      try {
        await channel?.close();
      } catch {
        // ignore
      }
      try {
        await connection?.close();
      } catch {
        // ignore
      }
    });
  },
  { name: "metrics" },
);
