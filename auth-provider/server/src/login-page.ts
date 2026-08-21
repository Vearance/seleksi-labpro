function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const PAGE_STYLE = `
  :root {
    --bg: #fafafa; --surface: #ffffff; --border: #e5e5e5;
    --ink: #18181b; --muted: #71717a; --danger: #dc2626;
    --radius: 12px;
    --font-sans: "Instrument Sans", system-ui, -apple-system, sans-serif;
    --font-mono: "IBM Plex Mono", ui-monospace, monospace;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    padding: 24px; background: var(--bg); color: var(--ink);
    font-family: var(--font-sans); font-size: 15px; line-height: 1.55;
    -webkit-font-smoothing: antialiased;
  }
  .card {
    width: 380px; background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 40px 36px;
  }
  .brand {
    font-family: var(--font-mono); font-size: 12px; font-weight: 500;
    letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); margin: 0 0 10px;
  }
  h1 { margin: 0 0 24px; font-size: 23px; font-weight: 600; letter-spacing: -0.01em; }
  form { display: flex; flex-direction: column; gap: 14px; }
  label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 500; }
  input {
    font-family: inherit; font-size: 14px; padding: 9px 12px;
    border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--ink);
  }
  input:focus { outline: none; border-color: var(--ink); }
  button {
    font-family: inherit; font-size: 14px; font-weight: 500; padding: 10px 16px;
    border: none; border-radius: 8px; background: var(--ink); color: #fff; cursor: pointer;
  }
  button:hover { opacity: 0.88; }
  .error { color: var(--danger); font-size: 13px; margin: 14px 0 0; }
  .note { color: var(--muted); font-size: 13px; margin: 20px 0 0; text-align: center; }
`;

/** Minimal SSO login page served by the auth provider (no SPA needed). */
export function renderLoginPage(returnTo: string, error?: string): string {
  const safeReturnTo = escapeHtml(returnTo);
  const errorHtml = error ? `<p class="error">${escapeHtml(error)}</p>` : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Sign in — SSO</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Instrument+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet" />
  <style>${PAGE_STYLE}</style>
</head>
<body>
  <div class="card">
    <p class="brand">SSO · Identity Provider</p>
    <h1>Sign in</h1>
    ${errorHtml}
    <form id="login-form">
      <input type="hidden" id="return-to" value="${safeReturnTo}" />
      <label>Email
        <input name="email" type="email" autocomplete="username" required />
      </label>
      <label>Password
        <input name="password" type="password" autocomplete="current-password" required />
      </label>
      <button type="submit">Sign in</button>
    </form>
    <p id="error" class="error" style="display:none">Invalid credentials</p>
  </div>
  <script>
    document.getElementById("login-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const form = e.target;
      const returnTo = document.getElementById("return-to").value;
      const res = await fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email.value, password: form.password.value })
      });
      if (res.ok) {
        window.location.href = returnTo;
      } else {
        document.getElementById("error").style.display = "block";
      }
    });
  </script>
</body>
</html>`;
}

/** Generic error page (no redirect, no sensitive detail). */
export function renderErrorPage(message: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Error — SSO</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Instrument+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet" />
  <style>${PAGE_STYLE}</style>
</head>
<body>
  <div class="card">
    <p class="brand">SSO · Identity Provider</p>
    <h1>Something went wrong</h1>
    <p class="error">${escapeHtml(message)}</p>
  </div>
</body>
</html>`;
}

/** SSO home page: shows the signed-in identity + a global logout button. */
export function renderSsoHomePage(name: string, email: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SSO — ${escapeHtml(name)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Instrument+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet" />
  <style>${PAGE_STYLE}</style>
</head>
<body>
  <div class="card">
    <p class="brand">SSO · Identity Provider</p>
    <h1>Hello, ${escapeHtml(name)}</h1>
    <p class="note">${escapeHtml(email)} · signed in on every app.</p>
    <button id="logout-btn" type="button" style="width:100%">Log out everywhere</button>
  </div>
  <script>
    document.getElementById("logout-btn").addEventListener("click", async () => {
      await fetch("/logout", { method: "POST" });
      window.location.href = "/login";
    });
  </script>
</body>
</html>`;
}
