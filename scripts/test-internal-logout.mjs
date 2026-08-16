import { createHmac } from "node:crypto";

// Dev helper: send a signed POST to App A's /internal/logout.
// Run twice to verify idempotency (second call returns success without re-processing).
const SECRET = process.env.INTERNAL_HMAC_SECRET ?? "change-me-internal-hmac-secret";
const BASE = process.env.APP_A_INTERNAL_URL ?? "http://localhost:4001";

// Fixed event_id so a second run exercises the dedupe path.
const event = {
  eventId: "11111111-1111-4111-8111-111111111111",
  eventType: "SessionRevoked",
  userId: "00000000-1000-4000-8000-000000000002", // alice
  centralSessionId: "22222222-2222-4222-8222-222222222222", // set to a real session to test revocation
  applicationId: null,
  reason: "sso_logout",
  occurredAt: new Date().toISOString(),
  metadata: {},
};

const timestamp = String(Math.floor(Date.now() / 1000));
const canonical = [
  event.eventId,
  event.eventType,
  event.userId,
  event.centralSessionId,
  event.reason,
].join(":");
const signature = createHmac("sha256", SECRET).update(`${timestamp}.${canonical}`).digest("hex");

const res = await fetch(`${BASE}/internal/logout`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-internal-timestamp": timestamp,
    "x-internal-signature": signature,
  },
  body: JSON.stringify(event),
});

console.log(res.status, await res.text());
