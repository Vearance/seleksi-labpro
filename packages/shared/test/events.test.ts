import { describe, expect, it } from "vitest";
import { EventEnvelopeSchema, EventTypeSchema } from "../src/events.js";

const uuid = (n: string) => `00000000-0000-4000-8000-${n.padStart(12, "0")}`;

describe("EventTypeSchema", () => {
  it("accepts the three supported event types", () => {
    for (const type of ["SessionRevoked", "PasswordChanged", "AccessPolicyChanged"]) {
      expect(EventTypeSchema.parse(type)).toBe(type);
    }
  });

  it("rejects unknown event types", () => {
    expect(() => EventTypeSchema.parse("UnknownType")).toThrow();
  });
});

describe("EventEnvelopeSchema", () => {
  const base = {
    eventId: uuid("1"),
    eventType: "SessionRevoked",
    userId: uuid("2"),
    centralSessionId: uuid("3"),
    applicationId: null,
    reason: "sso_logout",
    occurredAt: "2026-07-28T10:00:00.000Z",
  };

  it("accepts a valid envelope matching the spec payload", () => {
    const parsed = EventEnvelopeSchema.parse(base);
    expect(parsed.eventType).toBe("SessionRevoked");
    expect(parsed.applicationId).toBeNull();
  });

  it("defaults metadata to an empty object when omitted", () => {
    const parsed = EventEnvelopeSchema.parse(base);
    expect(parsed.metadata).toEqual({});
  });

  it("accepts an application-scoped event with an applicationId", () => {
    const parsed = EventEnvelopeSchema.parse({
      ...base,
      eventType: "AccessPolicyChanged",
      applicationId: uuid("4"),
    });
    expect(parsed.applicationId).toBe(uuid("4"));
  });

  it("requires a valid UUID userId", () => {
    expect(() => EventEnvelopeSchema.parse({ ...base, userId: "not-a-uuid" })).toThrow();
  });

  it("rejects an unknown eventType", () => {
    expect(() => EventEnvelopeSchema.parse({ ...base, eventType: "Nope" })).toThrow();
  });
});
