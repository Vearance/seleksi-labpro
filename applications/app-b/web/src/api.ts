export interface MeResponse {
  user: { name: string; email: string; groups: string[] };
  session: { status: string; createdAt: string; expiresAt: string };
}

export interface ActivityEntry {
  id: string;
  event: string;
  correlationId: string | null;
  createdAt: string;
}

export interface ProcessedEvent {
  eventId: string;
  eventType: string;
  processedAt: string;
  result: string;
}

export async function getMe(): Promise<MeResponse | null> {
  const res = await fetch("/api/me");
  if (!res.ok) return null;
  return res.json();
}

export async function listActivity(): Promise<ActivityEntry[]> {
  const res = await fetch("/api/activity-log");
  if (!res.ok) throw new Error("Failed to load activity log");
  const data = (await res.json()) as { entries: ActivityEntry[] };
  return data.entries;
}

export async function listProcessedEvents(): Promise<ProcessedEvent[]> {
  const res = await fetch("/api/processed-events");
  if (!res.ok) throw new Error("Failed to load processed events");
  const data = (await res.json()) as { events: ProcessedEvent[] };
  return data.events;
}

export async function logout(): Promise<void> {
  await fetch("/api/logout", { method: "POST" });
}
