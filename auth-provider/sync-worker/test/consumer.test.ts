import { afterEach, describe, expect, it, vi } from "vitest";
import type { EventEnvelope } from "@sso/shared";
import { handleEvent } from "../src/consumer.js";
import { notifyApp } from "../src/notifier.js";

const envelope: EventEnvelope = {
  eventId: "11111111-1111-4111-8111-111111111111",
  eventType: "SessionRevoked",
  userId: "00000000-1000-4000-8000-000000000002",
  centralSessionId: "22222222-2222-4222-8222-222222222222",
  applicationId: null,
  reason: "sso_logout",
  occurredAt: "2026-08-17T10:00:00.000Z",
  metadata: {},
};

const apps = [
  { id: "app-a-id", logoutNotificationUrl: "http://app-a:4001/internal/logout" },
  { id: "app-b-id", logoutNotificationUrl: "http://app-b:4002/internal/logout" },
];

function buildDb(opts?: { existingStatus?: (applicationId: string) => unknown }) {
  const findUnique = vi.fn(
    async (args: { where: { eventId_applicationId: { applicationId: string } } }) => {
      const applicationId = args.where.eventId_applicationId.applicationId;
      if (opts?.existingStatus) return opts.existingStatus(applicationId);
      return null;
    },
  );
  const create = vi.fn(async (args: { data: Record<string, unknown> }) => args.data);
  const update = vi.fn(async (args: { data: Record<string, unknown> }) => args.data);

  const db = {
    application: { findMany: vi.fn(async () => apps) },
    eventDelivery: { findUnique, create, update },
  } as never;

  return { db, create, update, findUnique };
}

describe("handleEvent", () => {
  it("notifies every active app and marks deliveries succeeded", async () => {
    const notify = vi.fn(async () => ({ ok: true }));
    const { db, create, update } = buildDb();

    const ok = await handleEvent(db, envelope, "secret", notify);

    expect(ok).toBe(true);
    expect(notify).toHaveBeenCalledTimes(2);

    const creates = create.mock.calls.map((c) => c[0].data as Record<string, unknown>);
    expect(creates).toHaveLength(2);
    expect(creates[0]).toMatchObject({
      eventId: envelope.eventId,
      applicationId: "app-a-id",
      status: "PROCESSING",
      attemptCount: 1,
    });
    expect(creates[1]).toMatchObject({ applicationId: "app-b-id", status: "PROCESSING" });

    const updates = update.mock.calls.map((c) => c[0].data as Record<string, unknown>);
    expect(updates).toHaveLength(2);
    expect(updates[0]).toMatchObject({ status: "SUCCEEDED" });
    expect(updates[1]).toMatchObject({ status: "SUCCEEDED" });
  });

  it("isolates failures: one failing app does not block the other", async () => {
    const notify = vi.fn(async (url: string) =>
      url.includes("app-a") ? { ok: true } : { ok: false, error: "HTTP 500" },
    );
    const { db, update } = buildDb();

    const ok = await handleEvent(db, envelope, "secret", notify);

    expect(ok).toBe(false);
    const updates = update.mock.calls.map((c) => c[0].data as Record<string, unknown>);
    expect(updates).toHaveLength(2);
    expect(updates[0]).toMatchObject({ status: "SUCCEEDED" });
    expect(updates[1]).toMatchObject({ status: "RETRYING", lastError: "HTTP 500" });
  });

  it("skips apps whose delivery already succeeded (redelivery)", async () => {
    const notify = vi.fn(async () => ({ ok: true }));
    const { db, create } = buildDb({
      existingStatus: (applicationId) =>
        applicationId === "app-a-id" ? { status: "SUCCEEDED" } : null,
    });

    const ok = await handleEvent(db, envelope, "secret", notify);

    expect(ok).toBe(true);
    expect(notify).toHaveBeenCalledTimes(1);
    const creates = create.mock.calls.map((c) => c[0].data as Record<string, unknown>);
    expect(creates).toHaveLength(1);
    expect(creates[0]).toMatchObject({ applicationId: "app-b-id" });
  });
});

describe("notifyApp", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends a signed request and returns ok on 200", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await notifyApp("http://app-a:4001/internal/logout", "secret-at-least-32-chars", envelope);

    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://app-a:4001/internal/logout");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers["x-internal-signature"]).toBeTruthy();
    expect(headers["x-internal-timestamp"]).toBeTruthy();
  });

  it("returns ok:false with the status on a non-2xx response", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => new Response("{}", { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await notifyApp("http://app-a:4001/internal/logout", "secret-at-least-32-chars", envelope);

    expect(result.ok).toBe(false);
    expect(result.error).toBe("HTTP 401");
  });
});
