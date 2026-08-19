import { useEffect, useRef, useState } from "react";

interface MetricsSnapshot {
  timestamp: number;
  uptimeSeconds: number;
  http: {
    requestsTotal: number;
    errorsTotal: number;
    avgMs: number | null;
    p50Ms: number | null;
    p95Ms: number | null;
  };
  queues: {
    "sso.events": number;
    "sso.events.retry": number;
    "sso.events.dlq": number;
  };
  outboxPending: number;
}

const POLL_MS = 3_000;
const HISTORY_POINTS = 40;

function fmtMs(ms: number | null): string {
  return ms === null ? "—" : `${Math.round(ms)} ms`;
}

/** Minimal monochrome SVG sparkline for a series of values. */
function Sparkline({ points, height = 44 }: { points: number[]; height?: number }) {
  const width = 300;
  if (points.length < 2) {
    return (
      <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <line x1="0" y1={height - 1} x2={width} y2={height - 1} stroke="currentColor" strokeWidth="1" opacity="0.3" />
      </svg>
    );
  }
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;
  const stepX = width / (points.length - 1);
  const coords = points.map((p, i) => {
    const x = i * stepX;
    const y = height - 4 - ((p - min) / range) * (height - 8);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <polyline points={coords.join(" ")} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export default function MetricsPage() {
  const [snapshot, setSnapshot] = useState<MetricsSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestsPerMinute, setRequestsPerMinute] = useState<number | null>(null);
  const [errorRate, setErrorRate] = useState<number | null>(null);
  const [reqHistory, setReqHistory] = useState<number[]>([]);
  const [backlogHistory, setBacklogHistory] = useState<number[]>([]);
  const prevRef = useRef<MetricsSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch("/admin/metrics/snapshot");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const snap = (await res.json()) as MetricsSnapshot;
        if (cancelled) return;

        const prev = prevRef.current;
        if (prev && snap.timestamp > prev.timestamp) {
          const dtSeconds = (snap.timestamp - prev.timestamp) / 1000;
          const rpm = ((snap.http.requestsTotal - prev.http.requestsTotal) / dtSeconds) * 60;
          const requestsDelta = snap.http.requestsTotal - prev.http.requestsTotal;
          const errorsDelta = snap.http.errorsTotal - prev.http.errorsTotal;
          const errPct = requestsDelta > 0 ? (errorsDelta / requestsDelta) * 100 : 0;

          const rounded = Math.max(0, Math.round(rpm));
          setRequestsPerMinute(rounded);
          setErrorRate(Math.max(0, errPct));
          setReqHistory((h) => [...h.slice(-(HISTORY_POINTS - 1)), rounded]);

          const backlog =
            snap.queues["sso.events"] +
            snap.queues["sso.events.retry"] +
            snap.queues["sso.events.dlq"] +
            snap.outboxPending;
          setBacklogHistory((h) => [...h.slice(-(HISTORY_POINTS - 1)), backlog]);
        }

        prevRef.current = snap;
        setSnapshot(snap);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load metrics");
      }
    }

    void poll();
    const timer = setInterval(() => void poll(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const queues = snapshot?.queues;
  const totalBacklog =
    (queues?.["sso.events"] ?? 0) +
    (queues?.["sso.events.retry"] ?? 0) +
    (queues?.["sso.events.dlq"] ?? 0) +
    (snapshot?.outboxPending ?? 0);

  return (
    <section>
      <div className="metrics-head">
        <h2>Metrics</h2>
        <span className="live-indicator">
          <span className="live-dot" />
          live · every 3s
        </span>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="metrics-grid">
        <div className="stat-card">
          <span className="stat-label">Requests / min</span>
          <span className="stat-value">{requestsPerMinute ?? "—"}</span>
          <Sparkline points={reqHistory} />
        </div>
        <div className="stat-card">
          <span className="stat-label">Error rate</span>
          <span className="stat-value">
            {errorRate === null ? "—" : `${errorRate.toFixed(1)}%`}
          </span>
          <span className="stat-hint">status 4xx/5xx</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Latency p50</span>
          <span className="stat-value">{fmtMs(snapshot?.http.p50Ms ?? null)}</span>
          <span className="stat-hint">avg {fmtMs(snapshot?.http.avgMs ?? null)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Latency p95</span>
          <span className="stat-value">{fmtMs(snapshot?.http.p95Ms ?? null)}</span>
          <span className="stat-hint">
            {snapshot ? `uptime ${Math.floor(snapshot.uptimeSeconds / 60)}m` : "—"}
          </span>
        </div>
      </div>

      <div className="metrics-grid">
        <div className="stat-card">
          <span className="stat-label">Queue · sso.events</span>
          <span className="stat-value">{queues?.["sso.events"] ?? "—"}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Retry queue</span>
          <span className="stat-value">{queues?.["sso.events.retry"] ?? "—"}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Dead-letter queue</span>
          <span className="stat-value">{queues?.["sso.events.dlq"] ?? "—"}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Outbox pending</span>
          <span className="stat-value">{snapshot?.outboxPending ?? "—"}</span>
        </div>
      </div>

      <div className="stat-card">
        <span className="stat-label">Total backlog · queue + retry + DLQ + outbox</span>
        <span className="stat-value">{snapshot ? totalBacklog : "—"}</span>
        <Sparkline points={backlogHistory} height={56} />
      </div>
    </section>
  );
}
