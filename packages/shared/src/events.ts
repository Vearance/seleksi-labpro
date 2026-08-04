import { z } from "zod";

export const EVENT_TYPES = ["SessionRevoked", "PasswordChanged", "AccessPolicyChanged"] as const;

export const EventTypeSchema = z.enum(EVENT_TYPES);
export type EventType = z.infer<typeof EventTypeSchema>;

export const SessionRevokedEventSchema = z.object({
  userId: z.string().uuid(),
  sessionId: z.string().uuid(),
  reason: z.string().max(200).optional(),
});
export type SessionRevokedEventPayload = z.infer<typeof SessionRevokedEventSchema>;

export const PasswordChangedEventSchema = z.object({
  userId: z.string().uuid(),
  changedAt: z.string().datetime().optional(),
});
export type PasswordChangedEventPayload = z.infer<typeof PasswordChangedEventSchema>;

/**
 * Fired when an application's access policy changes (user added/removed from a
 * group, group policy for an app created/removed, user deactivated). The
 * affected user/app may be omitted when the change is global.
 */
export const AccessPolicyChangedEventSchema = z.object({
  userId: z.string().uuid().optional(),
  groupId: z.string().uuid().optional(),
  applicationId: z.string().uuid().optional(),
  reason: z.string().max(200).optional(),
});
export type AccessPolicyChangedEventPayload = z.infer<typeof AccessPolicyChangedEventSchema>;

/** Discriminated payload union keyed on `type`. */
export const EventPayloadSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("SessionRevoked"), data: SessionRevokedEventSchema }),
  z.object({ type: z.literal("PasswordChanged"), data: PasswordChangedEventSchema }),
  z.object({ type: z.literal("AccessPolicyChanged"), data: AccessPolicyChangedEventSchema }),
]);
export type EventPayload = z.infer<typeof EventPayloadSchema>;

/**
 * Wire format of an event as produced by the outbox and consumed by relying
 * applications. `applicationIds` are the target application client IDs.
 */
export const EventEnvelopeSchema = z.object({
  eventId: z.string().uuid(),
  type: EventTypeSchema,
  occurredAt: z.string().datetime(),
  applicationIds: z.array(z.string()).min(1),
  payload: EventPayloadSchema,
});
export type EventEnvelope = z.infer<typeof EventEnvelopeSchema>;
