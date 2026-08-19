import { useEffect, useState, type SubmitEvent } from "react";
import { getAdmin, login, type AdminUser, type User } from "./api";
import UsersPage from "./pages/UsersPage";
import GroupsPage from "./pages/GroupsPage";
import UserDetailPage from "./pages/UserDetailPage";
import ApplicationsPage from "./pages/ApplicationsPage";
import PoliciesPage from "./pages/PoliciesPage";
import MetricsPage from "./pages/MetricsPage";

function LoginForm({ onLogin }: { onLogin: (admin: AdminUser) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await login(email, password);
    if (res.ok) {
      const admin = (await res.json()) as AdminUser;
      onLogin(admin);
    } else {
      setError("Invalid credentials");
    }
    setSubmitting(false);
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <p className="login-brand">SSO · Control Panel</p>
        <h1>Admin sign in</h1>
        <form onSubmit={handleSubmit}>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
      </div>
    </div>
  );
}

type Page = "home" | "users" | "groups" | "applications" | "policies" | "metrics";

function Shell({ admin, onLogout }: { admin: AdminUser; onLogout: () => void }) {
  const [page, setPage] = useState<Page>("home");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  function navigate(next: Page) {
    setSelectedUser(null);
    setPage(next);
  }

  return (
    <div className="dashboard">
      <header>
        <span className="brand">SSO Control Panel</span>
        <nav>
          <button onClick={() => navigate("home")}>Home</button>
          <button onClick={() => navigate("users")}>Users</button>
          <button onClick={() => navigate("groups")}>Groups</button>
          <button onClick={() => navigate("applications")}>Applications</button>
          <button onClick={() => navigate("policies")}>Policies</button>
          <button onClick={() => navigate("metrics")}>Metrics</button>
        </nav>
        <div className="header-right">
          <span className="whoami">
            Hello, <strong>{admin.name}</strong>
          </span>
          <button
            className="ghost"
            onClick={async () => {
              await fetch("/admin/logout", { method: "POST" });
              onLogout();
            }}
          >
            Log out
          </button>
        </div>
      </header>
      <main>
        {selectedUser ? (
          <UserDetailPage user={selectedUser} onBack={() => setSelectedUser(null)} />
        ) : page === "users" ? (
          <UsersPage onOpenUser={setSelectedUser} />
        ) : page === "groups" ? (
          <GroupsPage />
        ) : page === "applications" ? (
          <ApplicationsPage />
        ) : page === "policies" ? (
          <PoliciesPage />
        ) : page === "metrics" ? (
          <MetricsPage />
        ) : (
          <>
            <h2>Welcome</h2>
            <p>You are signed in as {admin.email}.</p>
          </>
        )}
      </main>
    </div>
  );
}

export default function App() {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdmin()
      .then(setAdmin)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="loading">Loading…</p>;
  if (!admin) return <LoginForm onLogin={setAdmin} />;
  return <Shell admin={admin} onLogout={() => setAdmin(null)} />;
}
