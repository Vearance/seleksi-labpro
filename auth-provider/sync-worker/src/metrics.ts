import { Counter, Registry } from "prom-client";

export const registry = new Registry();
registry.setDefaultLabels({ service: "sync-worker" });

export const publishedEvents = new Counter({
  name: "outbox_events_published_total",
  help: "Outbox events published to the broker",
  registers: [registry],
});

export const handledEvents = new Counter({
  name: "events_handled_total",
  help: "Events handled by the consumer",
  labelNames: ["result"],
  registers: [registry],
});

export const deadLetteredEvents = new Counter({
  name: "events_dead_lettered_total",
  help: "Events sent to the dead-letter queue",
  registers: [registry],
});

export async function metricsText(): Promise<string> {
  return registry.metrics();
}
