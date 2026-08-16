export default function App() {
  return (
    <div className="shell">
      <header className="hero">
        <h1>APP A</h1>
        <p className="subtitle">Relying application A</p>
      </header>

      <main className="card">
        <p className="muted">
          Sign in with the central identity provider to continue.
        </p>
        <a className="button" href="/login">
          Login with SSO
        </a>
      </main>
    </div>
  );
}
