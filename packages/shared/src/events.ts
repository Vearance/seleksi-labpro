import { z } from "zod";

export const EVENT_TYPES = ["SessionRevoked", "PasswordChanged", "AccessPolicyChanged"] as const;

export const EventTypeSchema = z.enum(EVENT_TYPES);
export type EventType = z.infer<typeof EventTypeSchema>;

/**
 * Wire format of an event as stored in `events.payload` and published to the
 * message queue. Matches the spec's "Payload Event Minimum":
 *
 * ```
 * {
 *   "eventId": "uuid",
 *   "eventType": "SessionRevoked",
 *   "userId": "uuid",
 *   "centralSessionId": "uuid",
 *   "applicationId": null,
 *   "reason": "sso_logout",
 *   "occurredAt": "2026-07-28T10:00:00Z",
 *   "metadata": {}
 * }
 * ```
 *
 * `applicationId` is null when the event targets every relying application
 * (e.g. SSO logout / password change). `reason` carries the revocation cause
 * (e.g. `sso_logout`, `admin_revoke`, `password_changed`, `policy_changed`).
 */
export const EventEnvelopeSchema = z.object({
  eventId: z.string().uuid(),
  eventType: EventTypeSchema,
  userId: z.string().uuid(),
  centralSessionId: z.string().uuid().nullable(),
  applicationId: z.string().uuid().nullable(),
  reason: z.string().max(200).optional(),
  occurredAt: z.string().datetime(),
  metadata: z.record(z.unknown()).default({}),
});
export type EventEnvelope = z.infer<typeof EventEnvelopeSchema>;
