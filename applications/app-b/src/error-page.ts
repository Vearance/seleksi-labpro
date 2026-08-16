export function renderErrorPage(message: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>App B — Sign in error</title>
</head>
<body style="font-family:system-ui,sans-serif;max-width:520px;margin:80px auto;padding:0 16px;color:#1a1a1a">
  <h1>App B</h1>
  <p>Sign in failed.</p>
  <p style="color:#dc2626">${message}</p>
  <p><a href="/login">Try again</a></p>
</body>
</html>`;
}
