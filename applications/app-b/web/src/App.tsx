import { useEffect, useState } from "react";
import { getMe, type MeResponse } from "./api";
import HomePage from "./pages/HomePage";

export default function App() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMe()
      .then(setMe)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="loading">Loading…</p>;

  if (!me) {
    return (
      <div className="shell">
        <header className="hero">
          <h1>APP B</h1>
          <p className="sub">Relying application · Single sign-on</p>
        </header>
        <main className="card landing-card">
          <p className="muted">Sign in with the central identity provider to continue.</p>
          <a className="button" href="/login">
            Sign in with SSO
          </a>
        </main>
      </div>
    );
  }

  return <HomePage me={me} onLoggedOut={() => setMe(null)} />;
}
