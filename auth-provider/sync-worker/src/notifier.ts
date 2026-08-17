import { signInternalAuth, type EventEnvelope } from "@sso/shared";

export interface NotifyResult {
  ok: boolean;
  error?: string;
}

/**
 * Sends an HMAC-signed event to an app's `/internal/logout` endpoint.
 * Never throws; returns a result so per-app failures are isolated.
 */
export async function notifyApp(
  url: string,
  secret: string,
  envelope: EventEnvelope,
): Promise<NotifyResult> {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = signInternalAuth(secret, timestamp, {
    eventId: envelope.eventId,
    eventType: envelope.eventType,
    userId: envelope.userId,
    centralSessionId: envelope.centralSessionId,
    reason: envelope.reason,
  });

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-timestamp": timestamp,
        "x-internal-signature": signature,
      },
      body: JSON.stringify(envelope),
    });

    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "network error" };
  }
}
