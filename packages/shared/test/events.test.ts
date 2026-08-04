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
  it("accepts a valid SessionRevoked envelope", () => {
    const envelope = {
      eventId: uuid("1"),
      type: "SessionRevoked",
      occurredAt: "2026-08-04T10:00:00.000Z",
      applicationIds: ["app-a", "app-b"],
      payload: {
        type: "SessionRevoked",
        data: { userId: uuid("2"), sessionId: uuid("3"), reason: "user logout" },
      },
    };
    expect(EventEnvelopeSchema.parse(envelope).payload.type).toBe("SessionRevoked");
  });

  it("accepts any valid payload regardless of envelope-level type (cross-check is consumer logic)", () => {
    const envelope = {
      eventId: uuid("1"),
      type: "PasswordChanged",
      occurredAt: "2026-08-04T10:00:00.000Z",
      applicationIds: ["app-a"],
      payload: {
        type: "SessionRevoked",
        data: { userId: uuid("2"), sessionId: uuid("3") },
      },
    };
    // Schema validates the payload union independently — this is still valid input.
    expect(() => EventEnvelopeSchema.parse(envelope)).not.toThrow();
  });

  it("requires at least one target application", () => {
    const envelope = {
      eventId: uuid("1"),
      type: "PasswordChanged",
      occurredAt: "2026-08-04T10:00:00.000Z",
      applicationIds: [],
      payload: { type: "PasswordChanged", data: { userId: uuid("2") } },
    };
    expect(() => EventEnvelopeSchema.parse(envelope)).toThrow();
  });
});
