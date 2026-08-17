import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  listActivity,
  listProcessedEvents,
  logout,
  type ActivityEntry,
  type MeResponse,
  type ProcessedEvent,
} from "../api";

const PAGE_SIZE = 10;

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function HomePage({
  me,
  onLoggedOut,
}: {
  me: MeResponse;
  onLoggedOut: () => void;
}) {
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [events, setEvents] = useState<ProcessedEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activityPage, setActivityPage] = useState(1);
  const [eventsPage, setEventsPage] = useState(1);

  useEffect(() => {
    Promise.all([listActivity(), listProcessedEvents()])
      .then(([a, e]) => {
        setActivity(a);
        setEvents(e);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load data"));
  }, []);

  const activityPages = Math.max(1, Math.ceil(activity.length / PAGE_SIZE));
  const safeActivityPage = Math.min(activityPage, activityPages);
  const activitySlice = activity.slice(
    (safeActivityPage - 1) * PAGE_SIZE,
    safeActivityPage * PAGE_SIZE,
  );

  const eventsPages = Math.max(1, Math.ceil(events.length / PAGE_SIZE));
  const safeEventsPage = Math.min(eventsPage, eventsPages);
  const eventsSlice = events.slice(
    (safeEventsPage - 1) * PAGE_SIZE,
    safeEventsPage * PAGE_SIZE,
  );

  async function handleLogout() {
    await logout();
    onLoggedOut();
  }

  return (
    <div className="dashboard">
      <header>
        <span className="brand">APP B</span>
        <div className="header-right">
          <span className="whoami">
            Hello, <strong>{me.user.name}</strong>
          </span>
          <button className="ghost-danger" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>

      <main>
        {error && <p className="error">{error}</p>}

        <section className="grid">
          <div className="card">
            <div className="card-head">
              <p className="label">Session</p>
              <span className={`badge badge-${me.session.status.toLowerCase()}`}>
                {me.session.status}
              </span>
            </div>
            <div className="kv">
              <div className="kv-row">
                <span className="kv-k">Created</span>
                <span className="kv-v">{new Date(me.session.createdAt).toLocaleString()}</span>
              </div>
              <div className="kv-row">
                <span className="kv-k">Expires</span>
                <span className="kv-v">{new Date(me.session.expiresAt).toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="card">
            <p className="label">Profile</p>
            <div className="profile">
              <span className="avatar">{initialsOf(me.user.name)}</span>
              <div>
                <p className="profile-name">{me.user.name}</p>
                <p className="profile-email">{me.user.email}</p>
              </div>
            </div>
            <div className="chips">
              {me.user.groups.length === 0 ? (
                <span className="chip">no groups</span>
              ) : (
                me.user.groups.map((group) => (
                  <span key={group} className="chip">
                    {group}
                  </span>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <p className="label">Activity Log</p>
            <div className="pager">
              <button
                className="pager-btn"
                onClick={() => setActivityPage((p) => Math.max(1, p - 1))}
                disabled={safeActivityPage <= 1}
                aria-label="Previous page"
              >
                <ChevronLeft size={15} />
              </button>
              <span className="pager-info">
                {safeActivityPage} / {activityPages}
              </span>
              <button
                className="pager-btn"
                onClick={() => setActivityPage((p) => p + 1)}
                disabled={safeActivityPage >= activityPages}
                aria-label="Next page"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Event</th>
                <th>Correlation ID</th>
              </tr>
            </thead>
            <tbody>
              {activitySlice.length === 0 ? (
                <tr>
                  <td colSpan={3} className="muted">
                    No activity yet
                  </td>
                </tr>
              ) : (
                activitySlice.map((a) => (
                  <tr key={a.id}>
                    <td>{new Date(a.createdAt).toLocaleString()}</td>
                    <td>{a.event}</td>
                    <td>
                      <code>{a.correlationId ?? "—"}</code>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <section className="card">
          <div className="card-head">
            <p className="label">Processed Events</p>
            <div className="pager">
              <button
                className="pager-btn"
                onClick={() => setEventsPage((p) => Math.max(1, p - 1))}
                disabled={safeEventsPage <= 1}
                aria-label="Previous page"
              >
                <ChevronLeft size={15} />
              </button>
              <span className="pager-info">
                {safeEventsPage} / {eventsPages}
              </span>
              <button
                className="pager-btn"
                onClick={() => setEventsPage((p) => p + 1)}
                disabled={safeEventsPage >= eventsPages}
                aria-label="Next page"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Event ID</th>
                <th>Type</th>
                <th>Processed At</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {eventsSlice.length === 0 ? (
                <tr>
                  <td colSpan={4} className="muted">
                    No processed events yet
                  </td>
                </tr>
              ) : (
                eventsSlice.map((e) => (
                  <tr key={e.eventId}>
                    <td>
                      <code>{e.eventId}</code>
                    </td>
                    <td>{e.eventType}</td>
                    <td>{new Date(e.processedAt).toLocaleString()}</td>
                    <td>{e.result}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}
