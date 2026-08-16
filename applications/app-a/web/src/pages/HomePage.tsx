import { useEffect, useState } from "react";
import {
  listActivity,
  listProcessedEvents,
  logout,
  type ActivityEntry,
  type MeResponse,
  type ProcessedEvent,
} from "../api";

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

  useEffect(() => {
    Promise.all([listActivity(), listProcessedEvents()])
      .then(([a, e]) => {
        setActivity(a);
        setEvents(e);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load data"));
  }, []);

  async function handleLogout() {
    await logout();
    onLoggedOut();
  }

  return (
    <div className="dashboard">
      <header>
        <span className="brand">APP A</span>
        <span className="whoami">
          Hello, <strong>{me.user.name}</strong>
        </span>
      </header>

      <main>
        <section className="grid">
          <div className="card">
            <h2>Session</h2>
            <dl>
              <dt>Status</dt>
              <dd>
                <span className={`badge badge-${me.session.status.toLowerCase()}`}>
                  {me.session.status}
                </span>
              </dd>
              <dt>Created</dt>
              <dd>{new Date(me.session.createdAt).toLocaleString()}</dd>
              <dt>Expires</dt>
              <dd>{new Date(me.session.expiresAt).toLocaleString()}</dd>
            </dl>
            <button className="danger" onClick={handleLogout}>
              Logout
            </button>
          </div>

          <div className="card">
            <h2>Profile</h2>
            <p>
              <strong>{me.user.name}</strong>
            </p>
            <p className="muted">{me.user.email}</p>
            <p>Groups: {me.user.groups.join(", ") || "—"}</p>
          </div>
        </section>

        {error && <p className="error">{error}</p>}

        <section className="card">
          <h2>Activity Log</h2>
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Event</th>
                <th>Correlation ID</th>
              </tr>
            </thead>
            <tbody>
              {activity.length === 0 ? (
                <tr>
                  <td colSpan={3} className="muted">
                    No activity yet
                  </td>
                </tr>
              ) : (
                activity.map((a) => (
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
          <h2>Processed Events</h2>
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
              {events.length === 0 ? (
                <tr>
                  <td colSpan={4} className="muted">
                    No processed events yet
                  </td>
                </tr>
              ) : (
                events.map((e) => (
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
