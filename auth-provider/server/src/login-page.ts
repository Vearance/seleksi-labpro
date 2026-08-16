function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background: #f5f6f8; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; color: #1a1a1a; }
    .card { background: #fff; padding: 32px; border-radius: 12px; box-shadow: 0 8px 30px rgba(0,0,0,.08); width: 340px; }
    h1 { font-size: 20px; margin: 0 0 20px; }
    label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600; margin-bottom: 12px; }
    input { padding: 10px 12px; border: 1px solid #ccc; border-radius: 8px; font-size: 15px; }
    button { width: 100%; padding: 11px; border: none; border-radius: 8px; background: #2563eb; color: #fff; font-size: 15px; font-weight: 600; cursor: pointer; }
    .error { color: #dc2626; font-size: 13px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Sign in to continue</h1>
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
<head><meta charset="utf-8" /><title>Error</title></head>
<body style="font-family: system-ui, sans-serif; padding: 32px">
  <h1>Error</h1>
  <p>${escapeHtml(message)}</p>
</body>
</html>`;
}
